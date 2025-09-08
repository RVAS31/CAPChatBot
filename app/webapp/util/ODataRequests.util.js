sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
], function (Filter, FilterOperator) {
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
        onCreateItemWithAction: async function (oDataModel, sActionName, oPayload) {
            try {
                // 1. Bind to the unbound action (unbound actions are always root-level)
                const oActionBinding = oDataModel.bindContext(`/${sActionName}(...)`);

                // 2. Set input parameters (in your case: prompt)
                if (oPayload && oPayload.prompt) {
                    oActionBinding.setParameter("prompt", oPayload.prompt);
                }

                // 3. Execute the action
                await oActionBinding.execute();

                // 4. Get the response (for unbound actions returning String: { value: "..." })
                const oResponse = oActionBinding.getBoundContext().getObject();

                console.log("Action response:", oResponse);

                return oResponse?.value; // Return just the string
            } catch (error) {
                console.error("OData V4 action execution error:", error);
                throw error;
            }
        }


    };
});