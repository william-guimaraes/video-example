"use strict";
require("dotenv").config();

const express = require("express");
const SunshineConversationsApi = require("sunshine-conversations-client");
const bodyParser = require("body-parser");
const { triggerConversationExtension } = require("./intents.js");

const PORT = process.env.PORT || 8999;

const { APP_ID: appId, INTEGRATION_ID: integrationId, KEY_ID, SECRET, SERVICE_URL } = process.env;

const defaultClient = SunshineConversationsApi.ApiClient.instance;
const basicAuth = defaultClient.authentications["basicAuth"];
basicAuth.username = KEY_ID;
basicAuth.password = SECRET;

const messagesApiInstance = new SunshineConversationsApi.MessagesApi();

express()
  .use(bodyParser.json())
  .post("/api/webhooks", userMessageHandler)
  .listen(PORT, () => console.log("listening on port " + PORT));

async function userMessageHandler(req, res) {
  // Ignore v1 webhooks
  if (req.body.version) {
    console.log("Old version webhooks are received. Please use v2 webhooks.");
    return res.end();
  }
  
  const message = req.body.events[0].payload.message;
  const trigger = req.body.events[0].type;
  const conversationId = req.body.events[0].payload.conversation.id;
  const author = req.body.events[0].payload.message.author.type;
  
  // Ignore if it is not a user message
  if (trigger !== "conversation:message" || author !== "user") {
    return res.end();
  }
  
  try {
    const text = message.content.text.toLowerCase();
    triggerConversationExtension.forEach((trigger) => {
      text.includes(trigger) && sendWebView(conversationId);
    });
  } catch (err) {
    console.log("Error in webhook handler", err);
    res.status(500).send(err.message);
  }

  res.end();
}

async function sendWebView(conversationId) {
  const videoExampleUrl = "https://www.youtube.com/embed/u2EQduP24GE"
  const videoExampleName = "Best Blues Jazz Music - Beautiful (...)"
  const messagePost = new SunshineConversationsApi.MessagePost();

  messagePost.setAuthor({ type: "business" });
  messagePost.setContent({
    type: "text",
    text: `
      You received a video:
      ${videoExampleName}
    `,
    actions: [
      {
        type: "webview",
        text: "Open",
        uri: `${SERVICE_URL}/message-templates/video-template.html?url=${videoExampleUrl}`,
        fallback: 'https://wguimaraes.sa.ngrok.io/',
      }
    ]
  });

  try {
    await messagesApiInstance.postMessage(appId, conversationId, messagePost);
  } catch (e) {
    console.log(e)
  }
}
