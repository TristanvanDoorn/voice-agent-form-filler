let detectedFields = []; // Global variable to store detected form fields

function detectFormFields() {
    const formElements = document.querySelectorAll('input, select, textarea');
    // Clear previous fields
    detectedFields = []; 

    formElements.forEach(element => {
        const metadata = {
            element: element,
            name: element.name || null,
            id: element.id || null,
            type: element.type || element.tagName.toLowerCase(),
            placeholder: element.placeholder || null,
            label: null
        };

        if (element.id) {
            const labelFor = document.querySelector(`label[for="${element.id}"]`);
            if (labelFor) {
                metadata.label = labelFor.textContent.trim();
            }
        }

        if (!metadata.label) {
            const parentLabel = element.closest('label');
            if (parentLabel) {
                metadata.label = parentLabel.textContent.trim();
            }
        }
        
        if (metadata.type === 'select-one') { 
            metadata.type = 'select'; 
            metadata.options = [];
            element.querySelectorAll('option').forEach(optionElement => {
                metadata.options.push({
                    value: optionElement.value,
                    text: optionElement.textContent.trim()
                });
            });
        }

        detectedFields.push(metadata); // Populate the global variable
    });

    console.log("Detected fields:", detectedFields); // Log for verification
}

function createAgentUI() {
    // Create the agent container
    const agentContainer = document.createElement('div');
    agentContainer.id = 'agent-ui-container';

    // Create the widget header
    const widgetHeader = document.createElement('div');
    widgetHeader.id = 'agent-widget-header';
    widgetHeader.textContent = 'Agent Control';

    // Create the close button
    const closeButton = document.createElement('button');
    closeButton.id = 'agent-widget-close-button';
    closeButton.textContent = 'X';
    closeButton.addEventListener('click', () => {
        agentContainer.style.display = 'none';
    });
    widgetHeader.appendChild(closeButton);
    
    // Prepend header to container
    agentContainer.appendChild(widgetHeader); // Appending as first child before iframe

    // Create the iframe
    const agentFrame = document.createElement('iframe');
    agentFrame.src = 'about:blank'; // Placeholder src
    agentFrame.style.width = '100%';
    // Height will be controlled by flex-grow
    agentFrame.style.border = 'none'; // More specific than frameBorder=0 for CSS
    
    // Append iframe to container
    agentContainer.appendChild(agentFrame);
    
    // Append container to body
    document.body.appendChild(agentContainer);

    // Add CSS styles for the agent container, header, and button
    const styles = `
        #agent-ui-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 300px;
            height: 400px; /* This will be the total height */
            border: 1px solid #ccc;
            background-color: #fff;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            z-index: 10000;
            display: flex;
            flex-direction: column;
        }
        #agent-widget-header {
            padding: 5px;
            background-color: #f0f0f0;
            cursor: move;
            height: 25px; /* Fixed height for header */
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-sizing: border-box; /* Include padding in height */
        }
        #agent-widget-close-button {
            cursor: pointer;
            border: none;
            background: transparent;
            font-weight: bold;
            font-size: 16px;
        }
        #agent-ui-container iframe { /* Style iframe to take remaining space */
            flex-grow: 1;
            border: none; /* Ensure no internal border */
        }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    // Implement Draggable Functionality
    let isDragging = false;
    let offsetX, offsetY;

    widgetHeader.addEventListener('mousedown', (e) => {
        isDragging = true;
        // Calculate offset from top-left of the container
        offsetX = e.clientX - agentContainer.offsetLeft;
        offsetY = e.clientY - agentContainer.offsetTop;
        
        // Ensure top/left are used for positioning from now on
        agentContainer.style.right = 'auto';
        agentContainer.style.bottom = 'auto';
        
        widgetHeader.style.userSelect = 'none'; // Prevent text selection while dragging
        document.body.style.cursor = 'move'; // Optional: change cursor for the whole page
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;

        // Boundary checks
        newX = Math.max(0, Math.min(newX, window.innerWidth - agentContainer.offsetWidth));
        newY = Math.max(0, Math.min(newY, window.innerHeight - agentContainer.offsetHeight));

        agentContainer.style.left = newX + 'px';
        agentContainer.style.top = newY + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            widgetHeader.style.userSelect = 'auto';
            document.body.style.cursor = 'auto'; // Optional: reset page cursor
        }
    });
}

function handleIncomingFieldInstruction(payload) {
    console.log("handleIncomingFieldInstruction received payload:", payload);

    let foundFieldMetadata = null;
    if (payload.field_type === "id") {
        foundFieldMetadata = detectedFields.find(field => field.id === payload.field);
    } else if (payload.field_type === "name") {
        foundFieldMetadata = detectedFields.find(field => field.name === payload.field);
    } else if (payload.field_type === "placeholder") {
        foundFieldMetadata = detectedFields.find(field => 
            field.placeholder && field.placeholder.toLowerCase().includes(payload.field.toLowerCase())
        );
    }

    if (foundFieldMetadata && foundFieldMetadata.element) {
        const fieldElement = foundFieldMetadata.element;
        console.log(`Field found (Type: ${payload.field_type}, Query: "${payload.field}"). Will fill with value: "${payload.value}"`, foundFieldMetadata);
        
        fieldElement.value = payload.value;
        fieldElement.dispatchEvent(new Event('input', { bubbles: true }));
        fieldElement.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log(`Field "${foundFieldMetadata.label || foundFieldMetadata.name || foundFieldMetadata.id}" filled and events dispatched.`);

        if (payload.should_submit === true) {
            console.log("Form submission requested.");
            const parentForm = fieldElement.closest('form');
            if (parentForm) {
                let submitButton = parentForm.querySelector('button[type="submit"], input[type="submit"]');
                if (submitButton) {
                    console.log("Submit button found, clicking...", submitButton);
                    submitButton.click();
                } else {
                    console.log("No submit button found, calling form.submit() directly.");
                    parentForm.submit();
                }
            } else {
                console.log("Submission requested, but no parent form could be found for the field.");
            }
        }

    } else {
        console.log(`Field not found for field_type "${payload.field_type}" and field "${payload.field}"`);
    }
}

function setupLiveKitListeners() {
    console.log("Attempting to set up LiveKit listeners...");

    if (typeof livekit === 'undefined') {
        console.warn("LiveKit SDK (livekit global object) not found. Mocking message reception without actual LiveKit connection.");
    } else {
        console.log("LiveKit SDK found.");
        // Actual LiveKit setup would go here.
    }

    // Simulate receiving a message for 'id'
    setTimeout(() => {
        const mockPayloadId = { "field": "email", "value": "initial.email@example.com", "field_type": "id" };
        console.log("Simulated received message (LiveKit):", mockPayloadId);
        handleIncomingFieldInstruction(mockPayloadId);
    }, 2000); 

    // Simulate receiving a message for 'placeholder'
    setTimeout(() => {
        const mockPayloadPlaceholder = { "field": "your message", "value": "Initial message here.", "field_type": "placeholder" };
        console.log("Simulated received message (LiveKit):", mockPayloadPlaceholder);
        handleIncomingFieldInstruction(mockPayloadPlaceholder);
    }, 3000);

    // Simulate receiving a message for 'name' with should_submit: true
    setTimeout(() => {
        const mockPayloadNameSubmit = { "field": "name", "value": "Final Value Before Submit", "field_type": "name", "should_submit": true };
        console.log("Simulated received message (LiveKit - with submit):", mockPayloadNameSubmit);
        handleIncomingFieldInstruction(mockPayloadNameSubmit);
    }, 4000); 

    // Simulate a "field not found" case (after submission attempt)
     setTimeout(() => {
        const mockPayloadNotFound = { "field": "nonexistent", "value": "test", "field_type": "id" };
        console.log("Simulated received message (LiveKit):", mockPayloadNotFound);
        handleIncomingFieldInstruction(mockPayloadNotFound);
    }, 5000);
}

// Call the functions when the script loads
detectFormFields();
createAgentUI();
setupLiveKitListeners();
