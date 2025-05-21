let detectedFields = []; // Global variable to store detected form fields
window.currentLiveKitRoom = null; // Initialize global room variable

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

function createAgentUI(agentUiUrl) { 
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
    agentContainer.appendChild(widgetHeader); 

    // Create the iframe
    const agentFrame = document.createElement('iframe');
    agentFrame.src = agentUiUrl || 'about:blank'; 
    agentFrame.style.width = '100%';
    agentFrame.style.border = 'none'; 
    
    // Append iframe to container
    agentContainer.appendChild(agentFrame);
    
    // Append container to body
    document.body.appendChild(agentContainer);

    // Add CSS styles
    const styles = `
        #agent-ui-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 300px;
            height: 400px; 
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
            height: 25px; 
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-sizing: border-box; 
        }
        #agent-widget-close-button {
            cursor: pointer;
            border: none;
            background: transparent;
            font-weight: bold;
            font-size: 16px;
        }
        #agent-ui-container iframe { 
            flex-grow: 1;
            border: none; 
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
        offsetX = e.clientX - agentContainer.offsetLeft;
        offsetY = e.clientY - agentContainer.offsetTop;
        agentContainer.style.right = 'auto';
        agentContainer.style.bottom = 'auto';
        widgetHeader.style.userSelect = 'none'; 
        document.body.style.cursor = 'move'; 
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;
        newX = Math.max(0, Math.min(newX, window.innerWidth - agentContainer.offsetWidth));
        newY = Math.max(0, Math.min(newY, window.innerHeight - agentContainer.offsetHeight));
        agentContainer.style.left = newX + 'px';
        agentContainer.style.top = newY + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            widgetHeader.style.userSelect = 'auto';
            document.body.style.cursor = 'auto'; 
        }
    });
}

function handleIncomingFieldInstruction(instruction) { 
    console.log("handleIncomingFieldInstruction received instruction:", instruction);

    let foundFieldMetadata = null;
    if (instruction.field_type === "id") {
        foundFieldMetadata = detectedFields.find(field => field.id === instruction.field);
    } else if (instruction.field_type === "name") {
        foundFieldMetadata = detectedFields.find(field => field.name === instruction.field);
    } else if (instruction.field_type === "placeholder") {
        foundFieldMetadata = detectedFields.find(field => 
            field.placeholder && field.placeholder.toLowerCase().includes(instruction.field.toLowerCase())
        );
    }

    if (foundFieldMetadata && foundFieldMetadata.element) {
        const fieldElement = foundFieldMetadata.element;
        console.log(`Field found (Type: ${instruction.field_type}, Query: "${instruction.field}"). Will fill with value: "${instruction.value}"`, foundFieldMetadata);
        
        fieldElement.value = instruction.value;
        fieldElement.dispatchEvent(new Event('input', { bubbles: true }));
        fieldElement.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log(`Field "${foundFieldMetadata.label || foundFieldMetadata.name || foundFieldMetadata.id}" filled and events dispatched.`);

        if (instruction.should_submit === true) {
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
        console.log(`Field not found for field_type "${instruction.field_type}" and field "${instruction.field}"`);
    }
}

async function initializeLiveKitConnection(livekitUrl, livekitToken) {
    console.log("Attempting to connect to LiveKit with URL:", livekitUrl);

    if (typeof livekit === 'undefined') {
        console.error("LiveKit SDK (livekit global object) not found. Make sure it's loaded.");
        return null;
    }
    console.log("LiveKit SDK found.");

    const room = new livekit.Room();

    try {
        await room.connect(livekitUrl, livekitToken, {
            // autoSubscribe: false, 
        });
        console.log('Successfully connected to LiveKit room.');
        return room;
    } catch (error) {
        console.error('Failed to connect to LiveKit room:', error);
        return null;
    }
}

function setupDataChannelListeners(room) {
    if (!room) {
        console.error('Cannot set up DataChannel listeners: room object is null or undefined.');
        return;
    }

    console.log('Setting up DataChannel listeners...');

    room.on(livekit.RoomEvent.DataReceived, (payload, participant, kind, topic) => {
        console.log('DataReceived event:', { payload, participant, kind, topic });

        try {
            const textDecoder = new TextDecoder();
            const jsonString = textDecoder.decode(payload);
            const instruction = JSON.parse(jsonString);

            console.log('Decoded instruction:', instruction);
            handleIncomingFieldInstruction(instruction);
        } catch (e) {
            console.error('Failed to decode or parse data message:', e);
        }
    });

    console.log('DataChannel listeners set up.');
}


// Initialize the application
(async () => {
    // --- Configuration Section ---
    
    // URL of the voice agent's web interface to be loaded in the iframe.
    // Example: 'http://localhost:3000' or 'https://your-agent-ui-domain.com'
    const AGENT_UI_URL = 'https://example.com'; // TODO: Replace with your actual agent UI URL.

    // WebSocket URL of your LiveKit server.
    // Example: 'wss://your-livekit-instance.com'
    const LIVEKIT_URL = 'wss://your-livekit-server-placeholder.com'; // TODO: Replace with your LiveKit server URL.

    // IMPORTANT: LIVEKIT_TOKEN must be dynamically fetched from your secure backend.
    // Your backend should use the LiveKit Server SDK (with API Key & Secret)
    // to generate a short-lived token for this specific client.
    // Do NOT hardcode a static token here for production use.
    // Example backend endpoint: '/api/get-livekit-token?userId=...'
    const LIVEKIT_TOKEN = 'placeholder-dynamic-token'; // TODO: Replace with token fetching logic or a valid token for development.

    // --- End Configuration Section ---

    detectFormFields();
    createAgentUI(AGENT_UI_URL); 

    window.currentLiveKitRoom = await initializeLiveKitConnection(LIVEKIT_URL, LIVEKIT_TOKEN);
    
    if (window.currentLiveKitRoom) {
        console.log('LiveKit Room object ready for data channel setup.');
        setupDataChannelListeners(window.currentLiveKitRoom);
    } else {
        console.error('Cannot set up DataChannel listeners, room not available.');
    }
})();
