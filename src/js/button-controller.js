// "use strict"

// const api = require("./api");
// const utils = require("./utils");
// const merge = require("lodash.merge");


// module.exports = {
//   template: `

//   `,
//   // props: ["config"],
//   data: function () {
//     return {
//       confirmReset: false,
//       autoCheckUpgrade: true,
//       button_type: "",
//     };
//   },
//   methods: {
//     set_button_type: function () {
//       console.log("button fn called");
//       try {
//         api.put("/api/setButtonType", { " button_type": button_type });
//         console.log("api called");
//       } catch (error) {
//         console.error("settings error:", error);
//         alert("Cant set btn Type");
//         return;
//       }
//     },
//   },
// };
"use strict";

const api = require("./api");
const utils = require("./utils");
const merge = require("lodash.merge");

module.exports = {
  template: "#button-controller-view",
  props: ["config", "state"],

  data: function () {
    return {
      confirmReset: false,
      autoCheckUpgrade: true,
      button_type: "",
    };
  },

  methods: {

    reset: async function () {
      const config = {
        button: this.button_type,
      };
         console.log(this.button_type)
      try {
        // await api.put("config/save", config);
        this.confirmReset = false;
        this.$dispatch("update");
        SvelteComponents.showDialog("Message", {
          title: "Success",
          message: "button type set",
        });
      } catch (error) {
        console.error("Restore failed:", error);
        alert("OOPS! an error has occured");
      }
    },
  },
};
