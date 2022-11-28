"use strict";

const api = require("./api");
const utils = require("./utils");
const merge = require("lodash.merge");

module.exports = {
  template: "#initial-setup-template",
  props: ["config", "state"],

  data: function () {
    return {
      confirmReset: false,
      autoCheckUpgrade: true,
    };
  },

  methods: {
    set_config: async function () {
      const data = { setup:true };
      try {
        await api.put("set-initial-config", data);
        this.confirmReset = false;
        this.$dispatch("update");
        SvelteComponents.showDialog("Message", {
          title: "Success",
          message: "config-set",
        });
       location.replace("/");
      } catch (error) {
        console.error(
          "there was a problem in settinng up initial configuration:",
          error
        );
        alert("there was a problem in settinng up initial configuration");
      }
    },
  },
};
