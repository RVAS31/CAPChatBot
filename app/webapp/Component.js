/**
 * eslint-disable @sap/ui5-jsdocs/no-jsdoc
 */

sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "app/model/models",
    "sap/ui/core/routing/HashChanger"
],
    function (UIComponent, Device, models, HashChanger) {
        "use strict";

        return UIComponent.extend("app.Component", {
            metadata: {
                manifest: "json"
            },

            /**
             * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
             * @public
             * @override
             */
            init: function () {

                var oHashChanger = HashChanger.getInstance();
                if (!oHashChanger.getHash()) {
                    oHashChanger.replaceHash(""); // Only reset if no hash exists
                }

                // call the base component's init function
                UIComponent.prototype.init.apply(this, arguments);

                // enable routing
                this.getRouter().initialize();

                // set the device model
                this.setModel(models.createDeviceModel(), "device");
            }
        });
    }
);