"use strict";

const api = require("./api");
const utils = require("./utils");
const merge = require("lodash.merge");

const config_defaults = require("../resources/onefinity_defaults.json");


module.exports = {
    template: "#admin-general-view-template",
    props: [ "config", "state" ],

    data: function() {
        return {
            confirmReset: false,
            autoCheckUpgrade: true,
            reset_variant: ""
        };
    },

    ready: function() {
        this.autoCheckUpgrade = this.config.admin["auto-check-upgrade"];
    },

    methods: {
        backup: function() {
            document.getElementById("download-target").src = "/api/config/download";
        },

        restore_config: function() {
            utils.clickFileInput("restore-config");
        },

        restore: function(e) {
            const files = e.target.files || e.dataTransfer.files;
            if (!files.length) {
                return;
            }

            const fileReader = new FileReader();
            fileReader.onload = async ({ target }) => {
                let config;
                try {
                    config = JSON.parse(target.result);
                } catch (error) {
                    console.error("Invalid config file:", error);
                    alert("Invalid config file");
                    return;
                }

                try {
                    await api.put("config/save", config);
                    await api.put("set-initial-config",{ setup: true });
                    this.$dispatch("update");
                    SvelteComponents.showDialog("Message", {
                        title: "Success",
                        message: "Configuration restored"
                    });
                } catch (error) {
                    console.error("Restore failed:", error);
                    alert("Restore failed");
                }
            };

            fileReader.readAsText(files[0]);
        },

        reset: async function() {
            const config = merge(
                {},
                config_defaults,
            );
            config.initalConfig=false;

            try {
                await api.put("config/save", config);
                this.confirmReset = false;
                this.$dispatch("update");
                location.hash="get-started"
                location.reload()
                SvelteComponents.showDialog("Message", {
                    title: "Success",
                    message: "Configuration restored"
                });
            } catch (error) {
                console.error("Restore failed:", error);
                alert("Restore failed");
            }
        },

        check: function() {
            this.$dispatch("check");
        },

        upgrade: function() {
            this.$dispatch("upgrade");
        },

        upload_firmware: function() {
            utils.clickFileInput("upload-firmware");
        },

        upload: function(e) {
            const files = e.target.files || e.dataTransfer.files;
            if (!files.length) {
                return;
            }
            this.$dispatch("upload", files[0]);
        },

        change_auto_check_upgrade: function() {
            this.config.admin["auto-check-upgrade"] = this.autoCheckUpgrade;
            this.$dispatch("config-changed");
        }
    }
};
