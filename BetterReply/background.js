const replyList = []; // Added global array for reply to list of selected email addresses
let email = ""; // Added global variable to store the email address for reply
let replyToAllCC = false; // Added global variable to track if the reply is to all CC email addresses

// Regex pattern to match email addresses | Regex from therealrobster
const emailPattern = /[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}/g;

// Initialize the extension and remove existing local configuration on install if already exists
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    // Remove existing local configuration
    await browser.storage.local.clear();
    console.log("Local configuration cleared on install.");
  }
});

// Code from therealrobster =>

// Find the email addresses in the body
async function findEmailAddresses() {
  let tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const messages = await browser.messageDisplay.getDisplayedMessages(
    tabs[0].id
  );
  const message = messages?.messages?.[0]; // Get the first message if available

  // Find the 'from' email address
  const fromEmail = message.author.match(emailPattern)?.[0]; // Take the first match, if any

  // Get the email body
  let fullBody = await browser.messages.listInlineTextParts(message.id);

  // <= End of code from therealrobster

  // Find cc, to and reply-to email addresses
  const fullMessage = await browser.messages.getFull(message.id);
  const ccEmails =
    fullMessage.headers.cc?.[0]
      .match(emailPattern)
      .map((email) => email.toLowerCase()) || [];
  const toEmails = fullMessage.headers.to?.[0].match(emailPattern) || [];
  const replyToEmails =
    fullMessage.headers["reply-to"]?.[0]
      .match(emailPattern)
      .map((email) => email.toLowerCase()) || [];

  let part = "";
  // If there are no inline text parts, use nothing
  if (fullBody && fullBody.length > 0) {
    part = fullBody[0].content;
  }

  // Get the sort option from local storage or default to "alphabetical"
  let { sortOption } = await browser.storage.local.get("sortOption");
  if (sortOption === undefined) {
    sortOption = "alphabetical"; // Default sort option
  }

  const emails = [];
  switch (sortOption) {
    case "alphabetical": {
      emails.push(...(part.match(emailPattern) || [])); // Ensure `emails` is always an array

      // Push all emails together
      emails.push(fromEmail);
      emails.push(...toEmails);
      emails.push(...ccEmails);
      emails.push(...replyToEmails);
      // sort by email address
      emails.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      break;
    }
    case "categories": {
      emails.push(browser.i18n.getMessage("from"));
      emails.push(fromEmail);
      if (toEmails.length > 0) {
        // Only add CC emails that are not already in emails
        const uniqueTo = toEmails.filter(
          (cc) => !emails.includes(cc.toLowerCase())
        );
        if (uniqueTo.length > 0) {
          emails.push(browser.i18n.getMessage("to"));
          emails.push(
            ...uniqueTo.sort((a, b) =>
              a.toLowerCase().localeCompare(b.toLowerCase())
            )
          );
        }
      }
      if (ccEmails.length > 0) {
        // Only add CC emails that are not already in emails
        const uniqueCc = ccEmails.filter(
          (cc) => !emails.includes(cc.toLowerCase())
        );
        if (uniqueCc.length > 0) {
          emails.push(browser.i18n.getMessage("cc"));
          emails.push(
            ...uniqueCc.sort((a, b) =>
              a.toLowerCase().localeCompare(b.toLowerCase())
            )
          );
        }
      }
      if (
        replyToEmails.length > 0 &&
        replyToEmails[0] !== fromEmail.toLowerCase()
      ) {
        // Only add reply-to emails that are not already in emails
        const uniqueReplyTo = replyToEmails.filter(
          (r) => !emails.includes(r.toLowerCase())
        );
        if (uniqueReplyTo.length > 0) {
          emails.push(browser.i18n.getMessage("reply_to"));
          emails.push(
            ...uniqueReplyTo.sort((a, b) =>
              a.toLowerCase().localeCompare(b.toLowerCase())
            )
          );
        }
      }
      if (part.match(emailPattern) && part.match(emailPattern).length > 0) {
        // Only add content emails that are not already in emails
        const contentEmails =
          part.match(emailPattern).map((email) => email.toLowerCase()) || [];
        const uniqueContent = contentEmails.filter(
          (e) => !emails.includes(e.toLowerCase())
        );
        if (uniqueContent.length > 0) {
          emails.push(browser.i18n.getMessage("content emails"));
          emails.push(
            ...uniqueContent.sort((a, b) =>
              a.toLowerCase().localeCompare(b.toLowerCase())
            )
          );
        }
      }
      break;
    }
  }
  // Code from therealrobster =>

  // Normalize emails to lowercase and remove duplicates
  return [...new Set(emails.map((email) => email.toLowerCase()))];
}

// Global variable to track menu item IDs
const menuItemIds = [];

// Function to remove menu items by their IDs
async function removeMenuItems(ids) {
  //console.log("Removing menu items...");
  for (const id of ids) {
    try {
      //console.log(`Removing menu item: ${id}`);
      await browser.menus.remove(id);
    } catch (error) {
      console.error(`Failed to remove menu item ${id}:`, error);
    }
  }
}

// <= End of code from therealrobster

/**
 * Function to select or deselect an email address.
 * @param {string} id - The ID of the menu item.
 * @param {string} title - The title of the email address.
 * @param {boolean} isSelected - Whether the email address is currently selected.
 * @returns {Promise<void>}
 */
async function selectEmailAddress(id, title, isSelected) {
  try {
    // Toggle the selection of the email address
    if (isSelected) {
      replyList.splice(replyList.indexOf(title), 1);
      browser.menus.update(id, {
        title: `${title}`,
      });
      // Update the icon to indicate it's not selected
      browser.menus.update(id, {
        icons: undefined,
      });
    } else {
      replyList.push(title);
      browser.menus.update(id, {
        title: `${title} (${browser.i18n.getMessage("selected")})`,
      });
      // Update the icon to indicate it's selected
      browser.menus.update(id, {
        icons: "images/arrow_reply_16px.svg",
      });
    }
  } catch (error) {
    console.error(`Failed to select ${title} email address:`, error);
  }
}

/**
 * Function to inject the js script into the current tab.
 * @param tabId
 * @param jsScript
 * @returns {Promise<void>}
 */
async function injectScript(tabId, jsScript = "content-script.js") {
  try {
    await browser.scripting.executeScript({
      target: { tabId: tabId, allFrames: true },
      files: [jsScript],
    });
  } catch (e) {
    if (!e.message.includes("already exists")) {
      console.error("Failed to inject script :", e);
    }
  }
}

/**
 * Function to get the selected text in the message.
 * @returns {Promise<*|string>}
 */
async function getSelectedText() {
  // Get the current active tab
  const [tabs] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  const tabId = tabs?.id;
  const frames = await browser.webNavigation.getAllFrames({ tabId });
  if (!tabId) return;

  // Inject the content script to get the selected text
  await injectScript(tabId);

  // Loop through all frames to get the selected text
  for (const frame of frames) {
    try {
      const res = await browser.tabs.sendMessage(
        tabId,
        { command: "getSelectionText" },
        { frameId: frame.frameId }
      );
      return res.text;
    } catch (e) {
      console.error("Error getting selected text:", e);
    }
  }
  return ""; // Return an empty string if no selection is found
}

/**
 * Function to update the body with the selected text.
 * @param {string} selection - The selected text to insert.
 * @param {Object} updateDetails - The details of the compose message to update.
 * @returns {String} - The updated HTML body with the selection inserted.
 */
function replaceBodyWithSelection(selection, updateDetails) {
  // Used DOMParser to modify the HTML body
  const parser = new DOMParser();
  const doc = parser.parseFromString(updateDetails.body, "text/html");

  // Search for the blockquote to replace
  const blockquote = doc.querySelector("blockquote");
  if (blockquote) {
    // Replace the blockquote with the selection
    blockquote.innerHTML = selection;
  } else {
    // If no blockquote exists, create a new <blockquote> element
    const fallback = doc.createElement("blockquote");
    fallback.innerHTML = selection;
    doc.body.appendChild(fallback);
  }
  // Set the updated body back to the compose details
  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}

/**
 * Function to compose a reply to the selected email addresses.
 * @returns {Promise<void>}
 */
async function composeReply(toList = replyList, ccList = Set) {
  // Get the selected text in the message
  const selection = await getSelectedText();
  // Begin a reply to all selected email addresses
  const selectedMessage = await browser.mailTabs.getSelectedMessages();
  if (selectedMessage && selectedMessage.messages.length > 0) {
    const message = selectedMessage.messages[0];
    const replyTab = await browser.compose.beginReply(message.id);
    // Update the 'to' field of the reply with the selected email addresses
    const updateDetails = await browser.compose.getComposeDetails(replyTab.id);
    // get the account email
    const accountId = message.folder.accountId;
    const account = await browser.accounts.get(accountId);
    const accountEmail = account.name;
    // If the reply is to all CC email addresses, set the flag
    let uniqueCCList;
    if (replyToAllCC) {
      // get cc list that matches the email pattern
      const ccListArray =
        message.ccList.map((email) => email.match(emailPattern)) || [];
      const ccList = ccListArray.map((email) => email[0].toLowerCase());
      // get the 'to' email address.es
      const toListArray =
        message.recipients.map((email) => email.match(emailPattern)) || [];
      const toList = toListArray.map((email) => email[0].toLowerCase());
      // filter out the accountEmail from toList
      const filteredToList = toList.filter(
        (email) => email.toLowerCase() !== accountEmail.toLowerCase()
      );
      // push toList to the ccList and clear duplicates
      const uniqueCCSet = new Set([...ccList, ...filteredToList]);
      uniqueCCList = Array.from(uniqueCCSet).map((email) => {
        email.match(emailPattern);
        return email.toLowerCase();
      });
    }
    // If toList is empty, use the sender email address
    if (toList.length === 0) {
      const fullMessage = await browser.messages.getFull(
        selectedMessage.messages[0].id
      );
      const fromEmail = fullMessage.headers.from?.[0].match(emailPattern)?.[0];
      if (fromEmail) {
        toList.push(fromEmail); // Add the sender email address to the 'to' field
      } else {
        console.warn("No sender email address found.");
      }
    }
    updateDetails.from = accountEmail; // Set the 'from' field to the account email address
    updateDetails.to = toList; // Use the selected email addresses
    updateDetails.cc = uniqueCCList || []; // Use the CC email addresses if replying to all CC
    // If there is a selection, replace the body with the selection
    if (selection) {
      console.log(selection);
      updateDetails.body = replaceBodyWithSelection(selection, updateDetails);
      console.log("Updated body with selection:", updateDetails.body);
    }
    await browser.compose.setComposeDetails(replyTab.id, updateDetails);
    replyList.length = 0; // Clear the reply list after sending
    replyToAllCC = false; // Reset the flag after handling the reply
  } else {
    console.warn("No message selected to reply to.");
  }
}
// Code from therealrobster =>

// Function to create or update menu items
async function createOrUpdateMenuItem(id, title) {
  // Check if the menu item ID is already tracked
  if (menuItemIds.includes(id)) {
    console.log(`Menu item ${id} already exists, skipping creation.`);
    return;
  }

  // <= End of code from therealrobster
  const isSelected = replyList.includes(title);

  try {
    // Create the main menu item
    await browser.menus.create({
      id: `${id}`,
      contexts: ["message_display_action_menu"],
      title: title,
      icons: isSelected ? "images/arrow_reply_16px.svg" : undefined,
    });
    // create a sub-menu item for replying to one email address
    await browser.menus.create({
      id: `reply-${id}`,
      title: title,
      contexts: ["message_display_action_menu"],
      parentId: "reply-to",
    });
    menuItemIds.push(`reply-${id}`); // Track the ID of the reply sub-menu item
    // Code from therealrobster =>
    menuItemIds.push(id); // Track the ID of the created menu item
  } catch (error) {
    console.error(`Failed to create menu item ${id}:`, error);
  }
}

// Function to remove all tracked menu items
async function removeAllMenuItems() {
  await removeMenuItems(menuItemIds);
  menuItemIds.length = 0; // Clear the tracked IDs
}

// Add a listener for the menus.onShown event
browser.menus.onShown.addListener(async () => {
  try {
    // Remove all existing menu items
    await removeAllMenuItems();

    // Call the function and handle the result
    const emailAddresses = await findEmailAddresses();

    // Update the menu with the found email address count
    try {
      // <= End of code from therealrobster
      await browser.menus.update("reply-to-selected-list", {
        title:
          browser.i18n.getMessage("reply_to_selected_list") +
          " (" +
          replyList.length +
          ")",
        enabled: replyList.length > 0, // Enable only if there are items in the reply list
      });
      // update rest of items
      await browser.menus.update("reply-to", {
        title: browser.i18n.getMessage("reply_to_directly"),
      });
      await browser.menus.update("empty-reply-list", {
        title: browser.i18n.getMessage("empty_reply_list"),
        enabled: replyList.length > 0, // Enable only if there are items in the reply list
      });
      await browser.menus.update("reply-to-all", {
        title: browser.i18n.getMessage("reply_to_all"),
      });
      // Code from therealrobster =>
      await browser.menus.update("my-menu-item", {
        title: browser.i18n.getMessage(
          "found_email_address",
          // Filter email addresses to count only valid ones
          emailAddresses.filter((email) => email.includes("@")).length
        ),
        enabled: false,
      });
    } catch (error) {
      console.error(`Failed to update menu item my-menu-item:`, error);
    }

    // Create new menu items based on email addresses
    for (const item of emailAddresses) {
      const id = `email-${item.toLowerCase()}`;
      // Check if the item is an email address
      // If it contains an '@', treat it as an email address
      // Otherwise, treat it as a separator
      if (item.includes("@")) {
        // Create or update the menu item for the email address
        await createOrUpdateMenuItem(id, item);
      } else {
        // Create a separator for non-email items
        await browser.menus.create({
          id: `sep-${item.toLowerCase()}`,
          title: item,
          contexts: ["message_display_action_menu"],
          enabled: false,
        });
        menuItemIds.push(`sep-${item.toLowerCase()}`);
      }
    }

    // Update radio menu checked state according to the latest storage value
    let { sortOption } = await browser.storage.local.get("sortOption");
    if (!sortOption) sortOption = "alphabetical";
    await browser.menus.update("sort-alphabetical", {
      checked: sortOption === "alphabetical",
    });
    await browser.menus.update("sort-categories", {
      checked: sortOption === "categories",
    });

    // Refresh the menu to apply changes
    await browser.menus.refresh();
  } catch (error) {
    console.error("Error finding email addresses:", error);
  }
});

// Add a listener for the menus.onHidden event
browser.menus.onHidden.addListener(async () => {
  // Remove all menu items when the menu is hidden
  await removeAllMenuItems();
});

// Create a context menu item
(async () => {
  try {
    // <= End of code from therealrobster
    // create item for replying to one email
    await browser.menus.create({
      id: "reply-to",
      title: browser.i18n.getMessage("reply_to"),
      contexts: ["message_display_action_menu"],
    });
    // create item for replying to all email addresses in cc
    await browser.menus.create({
      id: "reply-to-all",
      title: browser.i18n.getMessage("reply_to_all"),
      contexts: ["message_display_action_menu"],
    });
    // create item for replying to selected list
    await browser.menus.create({
      id: "reply-to-selected-list",
      title:
        browser.i18n.getMessage("reply_to_selected_list") +
        " (" +
        replyList.length +
        ")",
      contexts: ["message_display_action_menu"],
      enabled: replyList.length > 0, // Enable only if there are items in the reply list
    });
    // Create item to empty the reply list
    await browser.menus.create({
      id: "empty-reply-list",
      title: browser.i18n.getMessage("empty_reply_list"),
      contexts: ["message_display_action_menu"],
      enabled: replyList.length > 0, // Enable only if there are items in the reply list
    });
    // Get the current sort option from storage
    let { sortOption } = await browser.storage.local.get("sortOption");
    if (!sortOption) sortOption = "alphabetical";
    // Create radio menu items for sorting options
    await browser.menus.create({
      id: "sort-options",
      title: browser.i18n.getMessage("sortingOptions"),
      contexts: ["message_display_action"],
    });
    await browser.menus.create({
      id: "sort-alphabetical",
      parentId: "sort-options",
      title: browser.i18n.getMessage("alphabeticalOrder"),
      type: "radio",
      checked: sortOption === "alphabetical",
      contexts: ["message_display_action"],
    });
    await browser.menus.create({
      id: "sort-categories",
      parentId: "sort-options",
      title: browser.i18n.getMessage("categoriesOrder"),
      type: "radio",
      checked: sortOption === "categories",
      contexts: ["message_display_action"],
    });
    // Code from therealrobster =>
    await browser.menus.create({
      id: "my-menu-item",
      title: browser.i18n.getMessage("finding_email_addresses"),
      contexts: ["message_display_action_menu"],
    });
    await browser.menus.refresh(); // Refresh the menu to apply changes
  } catch (error) {
    console.error(`Failed to create menu item my-menu-item:`, error);
  }
})();

// Function to modify the menu
async function modifyMenu() {
  // Refresh the menu to apply changes
  await browser.menus.refresh();
}

// <= End of code from therealrobster

// Empty reply list when there is a message change
browser.mailTabs.onSelectedMessagesChanged.addListener(() => {
  replyList.length = 0;
});

// reply always need to be an Array<String>
// Function check if the user receive the message as BCC and if it is the case, if the reply list contains other emails than the sender
// return true if the reply list contains other emails than the sender, false otherwise
async function imCCI(reply = replyList) {
  let tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const messages = await browser.messageDisplay.getDisplayedMessages(
    tabs[0].id
  );
  const fullMessage = await browser.messages.getFull(
    messages?.messages?.[0].id
  );
  const from = messages?.messages?.[0].author.match(emailPattern)?.[0];
  if (
    fullMessage.headers.bcc?.[0]
      .match(emailPattern)
      .map((email) => email.toLowerCase()) !== undefined
  ) {
    return !(reply.includes(from) && reply.length === 1);
  }
}

// Global listener for click events on the menu items
browser.menus.onClicked.addListener(async (info) => {
  if (info.menuItemId === "empty-reply-list") {
    // If the "Empty reply list" item is clicked, clear the reply list
    replyList.length = 0; // Clear the reply list
    await modifyMenu(); // Refresh the menu to reflect changes
  }

  // If the "Reply to selected list" item is clicked, handle the reply
  if (info.menuItemId === "reply-to-selected-list") {
    // Check if there are selected email addresses
    if (replyList.length > 0) {
      const imCCIResult = await imCCI();
      if (!imCCIResult) {
        // Get the selected text in the message
        await composeReply(replyList);
      } else {
        browser.windows.create({
          type: "popup",
          titlePreface: browser.i18n.getMessage("warning_title"),
          height: 600,
          width: 400,
          url: "warning.html",
        });
      }
    } else {
      console.warn("No email addresses selected for reply.");
    }
  }

  // If the "Reply to all" item is clicked, handle the reply to all email addresses, placing the sender in the 'to' field and all other email addresses in the 'cc' field
  if (info.menuItemId === "reply-to-all") {
    replyToAllCC = true; // Set the flag to true to indicate that the reply is to all CC email addresses
    const imCCIResult = await imCCI();
    if (!imCCIResult) {
      // get the cc list
      let tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const messages = await browser.messageDisplay.getDisplayedMessages(
        tabs[0].id
      );
      if (messages && messages.messages && messages.messages.length > 0) {
        // get cc list that matches the email pattern
        const ccList =
          messages.messages[0].ccList.map((email) =>
            email.match(emailPattern)
          )[0] || [];
        // get the 'to' email address.es
        const toList = messages.messages[0].recipients;
        // push toList to the ccList and clear duplicates
        const uniqueCCSet = new Set([...ccList, ...toList]);
        const uniqueCCList = Array.from(uniqueCCSet).map((email) => {
          email.match(emailPattern);
          return email.toLowerCase();
        });
        // Compose reply with no email addresses selected
        await composeReply([], uniqueCCList);
      }
    } else {
      browser.windows.create({
        type: "popup",
        titlePreface: browser.i18n.getMessage("warning_title"),
        height: 600,
        width: 400,
        url: "warning.html",
      });
    }
  }

  // If a reply sub-menu item is clicked, handle the reply to that specific email address
  if (
    info.menuItemId.startsWith("reply-") &&
    info.menuItemId !== "reply-to-selected-list" &&
    info.menuItemId !== "reply-to-all"
  ) {
    email = info.menuItemId.replace("reply-email-", "");
    const imCCIResult = await imCCI([email]);
    if (!imCCIResult) {
      replyList.length = 0; // Clear the reply list
      replyList.push(email); // Add the email to the reply list
      email = ""; // Clear the email variable
      await composeReply(replyList);
    } else {
      // If the user has selected an email address that is not allowed to reply to, show a warning
      browser.windows.create({
        type: "popup",
        titlePreface: browser.i18n.getMessage("warning_title"),
        height: 600,
        width: 400,
        url: "warning.html",
      });
    }
  }

  // If a menu item for an email address is clicked, toggle its selection
  if (info.menuItemId.startsWith("email-")) {
    const email = info.menuItemId.replace("email-", ""); // Get the email address from the ID
    await selectEmailAddress(info.menuItemId, email, replyList.includes(email));
  }

  // Handle sort option selection
  if (info.menuItemId === "sort-alphabetical") {
    await browser.storage.local.set({ sortOption: "alphabetical" });
    await browser.menus.update("sort-alphabetical", { checked: true });
    await browser.menus.update("sort-categories", { checked: false });
  }
  if (info.menuItemId === "sort-categories") {
    await browser.storage.local.set({ sortOption: "categories" });
    await browser.menus.update("sort-alphabetical", { checked: false });
    await browser.menus.update("sort-categories", { checked: true });
  }
});

browser.runtime.onMessage.addListener(async (message) => {
  if (message.action === "continue") {
    // If the message action is 'continue', proceed with composing the reply
    if (email !== "") {
      // If the email variable is not empty and the reply list is empty, add the email to the reply list
      replyList.length = 0; // Clear the reply list
      replyList.push(email);
      email = ""; // Clear the email variable
    }
    // Compose reply with no email addresses selected
    await composeReply();
  }
  if (message.action === "cancel") {
    await modifyMenu(); // Refresh the menu to reflect changes
  }
  replyToAllCC = false; // Reset the flag after handling the reply
});
