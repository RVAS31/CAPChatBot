sap.ui.define([
    "sap/m/FlexItemData"   // 👈 you need to declare this dependency
], function (FlexItemData) {
    "use strict";

    return {

        getAlignSelf: function (sSender) {
            return sSender === "user" ? "End" : "Start";
        },

        getBubbleClass: function (sSender) {
            let base = "sapUiSmallMargin"; // always applied
            return sSender === "user"
                ? base + " userBubble"
                : base + " botBubble";
        },


        /**
         * To format the createdAt
         * @param {*} sDate 
         * @returns 
         */
        formatCreatedAt: function (sDate) {
            if (!sDate) return "";
            const oDate = new Date(sDate);

            const datePart = oDate.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric"
            });

            const timePart = oDate.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false // Set to true if you want AM/PM
            });

            return `${datePart}, ${timePart}`;
        }
    };
});
