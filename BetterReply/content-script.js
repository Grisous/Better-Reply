browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === "getSelectionText") {
        const selection = window.getSelection()
        console.log("Selection:", selection);
        let text = ""
        if (selection) {
            // If there is a selection, we will extract the text from it
            for (let i = 0; i < selection.rangeCount; i++) {
                const range = selection.getRangeAt(i);
                const fragment = range.cloneContents();
                const div = document.createElement("div");
                div.appendChild(fragment);
                // iterate through child nodes to detect line breaks
                for (const child of div.childNodes) {
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        if (["DIV", "P", "BR"].includes(child.nodeName)) {
                            text += "<br>"; // Add explicit line break
                        }
                        text += child.textContent;
                    } else if (child.nodeType === Node.TEXT_NODE) {
                        text += child.nodeValue;
                    }
                }
            }
        }
        sendResponse({ text })
    }
});
