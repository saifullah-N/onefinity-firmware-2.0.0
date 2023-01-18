"use strict";

const api = require("./api");
const utils = require("./utils");
const merge = require("lodash.merge");

const config_defaults = require("../resources/onefinity_defaults.json");

const z_slider_defaults = {
  "Z-16 Original": {
    "travel-per-rev": 4,
    "min-soft-limit": -133,
    "max-velocity": 3,
  },
  "Z-20 Heavy Duty": {
    "travel-per-rev": 10,
    "min-soft-limit": -160,
    "max-velocity": 7,
  },
};  

module.exports = {
  template: "#z-slider-view-template",
  props: ["config", "state"],

  data: function () {
    return {
      autoCheckUpgrade: true,
      z_slider_variant: " ",
    };
  },

  ready: function () {
    this.autoCheckUpgrade = this.config.admin["auto-check-upgrade"];
  },

  methods: {
   previous: function () {
      location.hash = "default-config";
    },
    set_z_slider: async function () {
                
                
        const z_variant = merge({}, 
          this.config.motors[3],
          z_slider_defaults[this.z_slider_variant]);

        const config = merge(
          {},
        {motors:this.config["motors"]},
        config_defaults,
      );

       config.motors[3] = z_variant;
      try {
          await api.put("config/save",config);
          this.$dispatch("update");
          SvelteComponents.showDialog("Message", {
            title: "Success",
            message: "Configuration set!!",
          });
          location.hash = "button-controller";
      } catch (error) {
        console.error("Z slider failed:", error);
        alert("failed to set Z slider  ");
      }
    },
  },
};
