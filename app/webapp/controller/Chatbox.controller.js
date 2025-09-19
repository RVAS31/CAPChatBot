sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/UIComponent",
    "app/util/ODataRequests.util",
    "app/formatter/Layout.formatter",
],
    function (BaseController, JSONModel, MessageToast, UIComponent, ODataRequests, Layout) {
        "use strict";

        return BaseController.extend("app.controller.Chatbox", {
            formatter: Layout,
            onInit: function () {

                let that = this;

                //To refresh the chat box
                that.onRefreshChatBot();

            },

            onChatListUpdateFinished: function (oEvent) {
                var oList = oEvent.getSource();        // the List
                var aItems = oList.getItems();         // now contains all rendered CustomListItems

                aItems.forEach(function (oItem) {
                    var oHBox = oItem.getContent()[0];  // HBox
                    var oVBox = oHBox.getItems()[0];    // VBox inside HBox

                    // Get sender from the model
                    var sSender = oVBox.getBindingContext("chatBotModel").getProperty("sender");

                    // Apply bubble class
                    oVBox.addStyleClass(sSender === "user" ? "userBubble" : "botBubble");
                });
            },

            /**
             * To refresh the chat bot.
             */
            onRefreshChatBot: function () {
                let that = this;
                that.onObjectMatchedChatBot();
            },

            /**
             * to reinitilize everthing once the user clicks back
             * @param {*} oEvent 
             */
            onObjectMatchedChatBot: function () {
                let that = this;
                that.onInitChatBot();
            },

            /**
             * To init chat bot
             */
            onInitChatBot: function () {

                let that = this,
                    oViewModel = new JSONModel({
                        busy: false,
                        text: ""
                    });

                that.getView().setModel(oViewModel, "ChatBotViewModel");
                that.getView().setModel(new JSONModel([]), "chatBotModel");
                that._updateChatBot();

            },

            /** 
             * Updates the chatbox model with the newest SAP CX data
             * @constructor 
            */
            _updateChatBot: function () {

                let that = this;

                //To make the call that is saved in hanad db
                that._getAiCollection();
            },

            /**
             * To get the assigned roles and set the model up 
             */
            _getAiCollection: function () {

                let that = this;
                const oDataAIModel = that.getOwnerComponent().getModel("AIOdataModel");
                const oInput = that.byId("messageInput");

                if (!oDataAIModel) {
                    console.error("OData contact model not found.");
                    return;
                }


                if (!that._oBusyDialog) {
                    that._oBusyDialog = new sap.m.BusyDialog({
                        title: "Loading",
                        text: "Thinking..."
                    });
                }

                that._oBusyDialog.open();

                ODataRequests.onFetchItems(oDataAIModel, "/AICollection")
                    .then((items) => {

                        const messages = [];

                        // Sort items by createdAt ascending
                        items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                        items.forEach(item => {
                            // User prompt
                            messages.push({
                                sender: "user",
                                message: item.prompt,
                                timestamp: item.createdAt,
                                shouldNotReported: true
                            });

                            // AI response
                            messages.push({
                                sender: "bot",
                                message: item.response,
                                timestamp: item.createdAt,
                                shouldNotReported: item.isReport ? false : true
                            });
                        });

                        console.log(messages)
                        that.getView().getModel("chatBotModel").setData({ messages });

                        // ✅ Clear the input field after sending
                        oInput.setValue("");
                    })
                    .catch((error) => {

                        sap.m.MessageBox.error("Failed to contact AI: " + err.message);

                    }).finally(() => {

                        // Hide busy state when request is done
                        that._oBusyDialog.close();

                    });
            },

            /**
             * To ask AI 
             */
            onAskAI: function () {
                let that = this;
                const oDataAIModel = that.getOwnerComponent().getModel("AIOdataModel");
                let sPrompt = that.getView().getModel("ChatBotViewModel").getProperty("/text");;
                sPrompt = sPrompt.trim();

                if (!sPrompt) {
                    sap.m.MessageToast.show("Please type a message first.");
                    return;
                }

                try {
                    const sResponse = ODataRequests.onCreateItemWithAction(oDataAIModel, "askAI", { prompt: sPrompt });
                    that._updateChatBot();
                } catch (err) {
                    sap.m.MessageBox.error("Failed to call AI: " + err.message);
                }
            },

            /**
             * To change lively
             * @param {*} oEvent 
             */
            onLiveChange: function (oEvent) {
                // Get the new value from the input
                let that = this;
                const sValue = oEvent.getParameter("value");

                // Or enable/disable a button dynamically
                const oSendButton = that.byId("sendButton");
                oSendButton.setEnabled(!!sValue.trim());

                //To set up the chatbot view text model
                that.getView().getModel("ChatBotViewModel").setProperty("/text", sValue);
            }

        });
    });
