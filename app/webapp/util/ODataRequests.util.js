sap.ui.define([
], function () {
    "use strict";

    return {
        /**
         * Fetches a list of items from the OData V4 model.
         * @param {sap.ui.model.odata.v4.ODataModel} oDataModel - The OData V4 model instance.
         * @param {string} sPath - The entity set or collection path (e.g., "/ContactPerson").
         * @returns {Promise<Array>} - A promise resolving to the fetched data array.
         */
        onFetchItems: async function (oDataModel, sPath) {
            try {
                const oListBinding = oDataModel.bindList(sPath);
                const aContexts = await oListBinding.requestContexts();
                const aData = aContexts.map(oContext => oContext.getObject());
                return aData;
            } catch (error) {
                console.error("OData V4 fetch error:", error);
                throw error;
            }
        },

        /**
         * Calls an unbound action on the CAP OData V4 service.
         * Example: Call AIService.askAI with { prompt: "Hello AI" }
         *
         * @param {sap.ui.model.odata.v4.ODataModel} oDataModel - The OData V4 model instance
         * @param {string} sActionName - The action name (e.g., "askAI")
         * @param {Object} oPayload - The body of the request, must contain the action parameters
         * @returns {Promise<any>} - The action result
         */
        onCreateItemWithAction: async function (oDataModel, sActionName, oPayload = {}) {
            try {
                const oActionBinding = oDataModel.bindContext(`/${sActionName}(...)`);

                Object.keys(oPayload).forEach((k) => {
                    if (oPayload[k] !== undefined) {
                        oActionBinding.setParameter(k, oPayload[k]);
                    }
                });

                await oActionBinding.execute();

                const oResponse = oActionBinding.getBoundContext().getObject();
                return oResponse?.value ?? oResponse;
            } catch (error) {
                console.error("OData V4 action execution error:", error);
                throw error;
            }
        },

        /**
         * Calls an unbound CAP OData V4 action that takes an ID (UUID) and returns something
         * (e.g., String { value: "..." } or an object/entity).
         *
         * Example action: ChatService.getResponseById(ID: UUID) returns String
         * Example payload: { ID: "f3c2..." }
         *
         * @param {sap.ui.model.odata.v4.ODataModel} oDataModel - The OData V4 model instance
         * @param {string} sActionName - The action name (e.g., "getResponseById", "getPromptById")
         * @param {{ ID: string }} oPayload - Must contain the action parameter ID
         * @returns {Promise<any>} - The action result (string for primitive returns, object otherwise)
         */
        callUnboundActionWithId: async function (oDataModel, sActionName, oPayload) {
            try {
                const oActionBinding = oDataModel.bindContext(`/${sActionName}(...)`);

                if (oPayload && oPayload.ID) {
                    oActionBinding.setParameter("ID", oPayload.ID);
                } else {
                    throw new Error("Missing required parameter: ID");
                }

                await oActionBinding.execute();

                const oResponse = oActionBinding.getBoundContext().getObject();
                console.log("Action response:", oResponse);

                // CAP primitives typically come back as { value: ... }
                return (oResponse && Object.prototype.hasOwnProperty.call(oResponse, "value"))
                    ? oResponse.value
                    : oResponse;
            } catch (error) {
                console.error("OData V4 action execution error:", error);
                throw error;
            }
        },

        /**
         * Calls an unbound action on a CAP OData V4 service.
         *
         * @param {sap.ui.model.odata.v4.ODataModel} oDataModel - The OData V4 model instance
         * @param {string} sActionName - The action name (e.g., "askAI", "uploadTextDocument")
         * @param {Object} [mParams] - Key/value map of action parameters
         * @returns {Promise<any>} - Returns primitive value (oResponse.value) when present; otherwise returns full response object.
         */
        callUnboundActionV4: async function (oDataModel, sActionName, mParams = {}) {
            try {
                const oActionBinding = oDataModel.bindContext(`/${sActionName}(...)`);

                // Set all provided parameters dynamically
                Object.keys(mParams).forEach((sKey) => {
                    // Skip undefined so we don't accidentally send empty params
                    if (mParams[sKey] !== undefined) {
                        oActionBinding.setParameter(sKey, mParams[sKey]);
                    }
                });

                await oActionBinding.execute();

                const oResponse = oActionBinding.getBoundContext().getObject();

                // CAP typically wraps primitive returns as { value: ... }
                return (oResponse && Object.prototype.hasOwnProperty.call(oResponse, "value"))
                    ? oResponse.value
                    : oResponse;

            } catch (error) {
                console.error(`OData V4 action execution error (${sActionName}):`, error);
                throw error;
            }
        },


    };
});