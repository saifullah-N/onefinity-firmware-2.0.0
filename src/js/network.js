module.exports = {
  template: "#network-view-template",
  props: ["render"],

  attached: function () {
    this.svelteComponent = SvelteComponents.createComponent(
      "AdminNetworkView",
      document.getElementById("admin-network")
      );
      this.render=true
  },

  detached: function () {
    this.svelteComponent.$destroy();
  },
};
