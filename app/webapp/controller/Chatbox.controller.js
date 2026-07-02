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
                    pendingAttachment: null,
                    sessionId: sessionId,
                    context: { objectType: salesQuoteId ? "salesQuotes" : null, objectId: salesQuoteId || null }
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
            * Once the user clicks on the cancel the fragment dialog is closed.
            */
            onCancel: function () {
                let that = this,
                    upLoadSet = that.byId("UploadSet");

                //To check if the code and items
                if (upLoadSet.getItems().length === 1) {
                    //To enable the set property setSelectEnable to true
                    that.getView().getModel("appViewModel").setProperty("/setSelectEnabled", true);
                }

                that.closeFragmentUpload()
            },

            /**
             * To close fragment upload
             */
            closeFragmentUpload: function () {
                let that = this;
                // To close the fragment
                that.uploadDialog.then(function (oDialog) {
                    oDialog.close();
                }.bind(that));

            },

            /**
            * Once the user uploads on the fragment dialog pops up.
            */
            onUpload: function () {
                let that = this;

                // we use fragments. They are good to be used because they can be resued later on (xml fragments)
                if (!that.uploadDialog) {
                    that.uploadDialog = that.loadFragment({
                        name: "app.view.UploadDialog"
                    });
                }

                that.uploadDialog.then(function (oDialog) {

                    //To set the select enable false
                    that.getView().getModel("ChatBotViewModel").setProperty("/setSelectEnabled", false);

                    // To get away with the previos uploaded file
                    let upLoadSet = that.byId("UploadSet");

                    if (upLoadSet.getItems().length === 1) {
                        that.getView().getModel("ChatBotViewModel").setProperty("/setUploadEnabled", false);
                    }

                    oDialog.open();

                }.bind(that));
            },

            /**
             * To read file as base 64
             * @param {*} oFile 
             * @returns 
             */
            _readFileAsBase64: function (oFile) {
                return new Promise((resolve, reject) => {
                    const oReader = new FileReader();
                    oReader.onload = () => {
                        const sDataUrl = oReader.result; // data:<mime>;base64,xxxx
                        const sBase64 = sDataUrl.split("base64,")[1] || "";
                        resolve(sBase64);
                    };
                    oReader.onerror = reject;
                    oReader.readAsDataURL(oFile);
                });
            },

            /**
             * To save the document 
             * @returns 
             */
            onSaveDocument: async function () {
                try {

                    let that = this;
                    const oUploadSet = that.byId("UploadSet");

                    // With instantUpload=false, new files are usually in "incompleteItems"
                    const aItems = oUploadSet.getIncompleteItems().length
                        ? oUploadSet.getIncompleteItems()
                        : oUploadSet.getItems();

                    if (!aItems || aItems.length === 0) {
                        sap.m.MessageToast.show("Please add a TXT or DOCX file.");
                        return;
                    }

                    // single file MVP
                    const oItem = aItems[0];
                    const oFile = oItem.getFileObject();

                    if (!oFile) {
                        sap.m.MessageToast.show("Selected file is not accessible.");
                        return;
                    }

                    // Optional: enforce types also here
                    const sName = (oFile.name || "").toLowerCase();
                    if (!(sName.endsWith(".txt") || sName.endsWith(".docx"))) {
                        sap.m.MessageToast.show("Only TXT and DOCX are supported.");
                        return;
                    }

                    const sBase64 = await that._readFileAsBase64(oFile);

                    const oDataAIModel = that.getOwnerComponent().getModel("AIOdataModel");

                    const documentId = await ODataRequests.callUnboundActionV4(oDataAIModel, "uploadTextDocument", {
                        fileName: oFile.name,
                        mimeType: oFile.type || "",
                        contentBase64: sBase64
                    });

                    if (!documentId) {
                        throw new Error("uploadTextDocument returned no documentId");
                    }

                    const oChatModel = that.getView().getModel("chatBotModel");
                    oChatModel.setProperty("/pendingAttachment", {
                        documentId,
                        fileName: oFile.name,
                        mimeType: oFile.type || "",
                        size: oFile.size
                    });

                    oUploadSet.removeAllItems();

                    sap.m.MessageToast.show("Document attached. Now type your question and press Send.");
                    that.byId("messageInput")?.focus();

                } catch (err) {
                    console.error(err);
                    sap.m.MessageToast.show(`Attachment failed: ${err.message || err}`);
                }
            },

            /**
             * To cancel the upload
             */
            onCancelUpload: function () {
                let that = this;
                const oUploadSet = that.byId("UploadSet");
                oUploadSet.removeAllItems();
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
             * To send the prompt to the AI and get the response
             * @returns {Promise<void>}
             */
            onAskAI: async function () {

                let that = this;
                const oDataAIModel = that.getOwnerComponent().getModel("AIOdataModel");
                const oChatModel = that.getView().getModel("chatBotModel");

                const sPrompt = (oChatModel.getProperty("/currentPrompt") || "").trim();

                if (!sPrompt) {
                    sap.m.MessageToast.show("Please type a message first.");
                    return;
                }

                const oPending = oChatModel.getProperty("/pendingAttachment");
                const documentId = oPending?.documentId || null;

                const sessionId = oChatModel.getProperty("/sessionId");

                const oContext = oChatModel.getProperty("/context") || {};
                const salesQuoteId =
                    oContext.objectType === "salesQuotes"
                        ? oContext.objectId
                        : null;

                try {
                    let sResponse;

                    if (salesQuoteId) {
                        // Context-specific Sales Quote agent
                        sResponse = await ODataRequests.onCreateItemWithAction(
                            oDataAIModel,
                            "askSalesQuoteAgent",
                            {
                                prompt: sPrompt,
                                salesQuoteDisplayId: salesQuoteId,
                                sessionId: sessionId
                            }
                        );
                    } else {
                        // Generic AI agent
                        sResponse = await ODataRequests.onCreateItemWithAction(
                            oDataAIModel,
                            "askAI",
                            {
                                prompt: sPrompt,
                                documentId: documentId,
                                sessionId: sessionId
                            }
                        );
                    }

                    console.log("AI response:", sResponse);

                    // Clear input + attachment after send
                    oChatModel.setProperty("/currentPrompt", "");
                    oChatModel.setProperty("/pendingAttachment", null);

                    that._updateChatBot();

                } catch (err) {
                    sap.m.MessageBox.error("Failed to call AI: " + (err.message || err));
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
