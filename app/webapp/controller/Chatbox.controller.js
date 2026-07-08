sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/UIComponent",
    "app/util/ODataRequests.util",
    "app/util/Helper.util",
    "app/formatter/Layout.formatter",
],
    function (BaseController, JSONModel, MessageToast, UIComponent, ODataRequests, Helper, Layout) {
        "use strict";

        return BaseController.extend("app.controller.Chatbox", {
            formatter: Layout,
            onInit: function () {

                let that = this;

                //To refresh the chat box
                that.onRefreshChatBot();

            },

            onChatListUpdateFinished: function (oEvent) {
                var oList = oEvent.getSource();
                var aItems = oList.getItems();

                aItems.forEach(function (oItem) {
                    var oHBox = oItem.getContent()[0];
                    var oVBox = oHBox.getItems()[0];

                    var sSender = oVBox
                        .getBindingContext("chatBotModel")
                        .getProperty("sender");

                    oVBox.removeStyleClass("userBubble");
                    oVBox.removeStyleClass("botBubble");
                    oVBox.addStyleClass(sSender === "user" ? "userBubble" : "botBubble");
                });

                setTimeout(function () {
                    var oScrollContainer = this.byId("chatScrollContainer");

                    if (oScrollContainer) {
                        oScrollContainer.scrollTo(0, 999999, 300);
                    }
                }.bind(this), 100);
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
                        busy: false, text: "",
                        setUploadEnabled: true,
                        setSelectEnabled: false,
                    });

                that.getView().setModel(oViewModel, "ChatBotViewModel");

                const salesQuoteId = that._getSalesQuoteIdFromUrl();

                const sessionId = that._getSessionIdForContext(salesQuoteId);

                const oChatModel = new sap.ui.model.json.JSONModel({
                    messages: [],
                    currentPrompt: "",
                    sessionId: sessionId,
                    context: {
                        objectType: salesQuoteId ? "salesQuotes" : null,
                        objectId: salesQuoteId || null
                    }
                });

                oChatModel.setSizeLimit(5000); // to increase limit 

                that.getView().setModel(oChatModel, "chatBotModel");

                that._updateChatBot();
            },

            /**
             *  To get the session id for the context. If the sales quote id is given, it will be used to create a unique session id for that sales quote. Otherwise, a generic session id will be used.
             *  The session id is stored in localStorage to persist across page reloads.
             *  @returns {string} The session id for the current context.
             *  @param {*} salesQuoteId 
             */
            _getSessionIdForContext: function (salesQuoteId) {

                if (!salesQuoteId) {
                    let sessionId = window.localStorage.getItem("chatbox.session.generic");

                    if (!sessionId) {
                        sessionId = crypto.randomUUID();
                        window.localStorage.setItem("chatbox.session.generic", sessionId);
                    }

                    return sessionId;
                }

                const key = `chatbox.session.salesQuote.${salesQuoteId}`;
                let sessionId = window.localStorage.getItem(key);

                if (!sessionId) {
                    sessionId = crypto.randomUUID();
                    window.localStorage.setItem(key, sessionId);
                }

                return sessionId;
            },

            /**
             * To get the sales quote id from the url
             * @returns 
             */
            _getSalesQuoteIdFromUrl: function () {
                const params = new URLSearchParams(window.location.search);
                return params.get("salesQuoteId");
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

                const oDataAIModel =
                    that.getOwnerComponent().getModel("AIOdataModel");

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

                const oChatModel =
                    that.getView().getModel("chatBotModel");

                const sessionId =
                    oChatModel.getProperty("/sessionId");

                ODataRequests.onFetchItems(oDataAIModel, "/AICollection")

                    .then((items) => {

                        const filteredItems = (items || []).filter((item) => {
                            return item.sessionId === sessionId;
                        });

                        const messages = [];

                        filteredItems.sort((a, b) =>
                            new Date(a.createdAt) - new Date(b.createdAt)
                        );

                        filteredItems.forEach(item => {

                            messages.push({
                                sender: "user",
                                message: item.prompt,
                                timestamp: item.createdAt,
                                shouldNotReported: true
                            });

                            messages.push({
                                sender: "bot",
                                message: item.response,
                                timestamp: item.createdAt,
                                shouldNotReported:
                                    item.isReport ? false : true,
                                id: item.ID
                            });
                        });

                        console.log("Messages for session:", sessionId, messages);

                        oChatModel.setProperty("/messages", messages);
                        oChatModel.setProperty("/currentPrompt", "");

                    })

                    .catch((error) => {

                        sap.m.MessageBox.error(
                            "Failed to contact AI: " +
                            (error.message || error)
                        );

                    })

                    .finally(() => {

                        that._oBusyDialog.close();

                    });
            },

            /**
             * Sends the prompt to the Sales Quote AI Agent.
             * @returns {Promise<void>}
             */
            onAskAI: async function () {
                const oDataAIModel = this.getOwnerComponent().getModel("AIOdataModel");
                const oChatModel = this.getView().getModel("chatBotModel");

                const sPrompt = (oChatModel.getProperty("/currentPrompt") || "").trim();

                if (!sPrompt) {
                    sap.m.MessageToast.show("Please type a message first.");
                    return;
                }

                const sSessionId = oChatModel.getProperty("/sessionId");

                const oContext = oChatModel.getProperty("/context") || {};
                const sSalesQuoteId =
                    oContext.objectType === "salesQuotes"
                        ? oContext.objectId
                        : null;

                if (!sSalesQuoteId) {
                    sap.m.MessageBox.error("No Sales Quote context found.");
                    return;
                }

                try {
                    await ODataRequests.onCreateItemWithAction(
                        oDataAIModel,
                        "askSalesQuoteAgent",
                        {
                            prompt: sPrompt,
                            salesQuoteDisplayId: sSalesQuoteId,
                            sessionId: sSessionId
                        }
                    );

                    oChatModel.setProperty("/currentPrompt", "");

                    this._updateChatBot();

                } catch (err) {
                    sap.m.MessageBox.error("Failed to call Sales Quote Agent: " + (err.message || err));
                }
            },

            /**
             * To change lively the text in the input field and enable/disable the send button
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
            },

            /**
             * To download the report
             * @param {*} oEvent 
             */
            onDownloadReport: async function (oEvent) {

                let that = this;
                const oButton = oEvent.getSource();
                const sReportId = oButton.data("reportId");
                const oDataAIModel = that.getOwnerComponent().getModel("AIOdataModel");

                // To check if the reportId is given
                if (!sReportId) {
                    sap.m.MessageToast.show("an ID has not been found");
                    return;
                }

                try {
                    const sReportText = await ODataRequests.callUnboundActionWithId(oDataAIModel, "getResponseById", { ID: sReportId });
                    const sSubject = `Report for prompt ${sReportId}`;
                    const sBody = sReportText || "(No report text returned)";
                    const sHtml = Helper.reportTextToHtml(sBody);

                    // Generate .eml (HTML + plain text)
                    Helper.buildAndDownloadEmlHtml({
                        to: "", // optional
                        subject: sSubject,
                        plainText: sBody,
                        html: sHtml,

                        // Optional: also attach the raw report as txt
                        attachments: [{
                            filename: "report.txt",
                            contentType: "text/plain; charset=UTF-8",
                            contentText: sBody
                        }]
                    });

                } catch (err) {
                    sap.m.MessageBox.error("Failed to call HANA DB: " + err.message);
                }
            },

            /**
             * To remove the attachment
             */
            onRemoveAttachment: function () {
                let that = this;
                that.getView().getModel("chatBotModel").setProperty("/pendingAttachment", null);
            },

            onAfterItemAdded: function () {
                let that = this;
                that.byId("_IDGenButton1").setEnabled(true); // your Save button id
            },

            onAfterItemRemoved: function () {
                let that = this;
                const oUploadSet = this.byId("UploadSet");
                const hasItems = oUploadSet.getIncompleteItems().length || oUploadSet.getItems().length;
                that.byId("_IDGenButton1").setEnabled(!!hasItems);
            }


        });
    });
