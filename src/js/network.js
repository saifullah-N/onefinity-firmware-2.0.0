module.exports = {
  template: "#network-view-template",
  data:function () {
    return {
      renderd: false,
    };
  },

  attached: function () {
    this.svelteComponent = SvelteComponents.createComponent(
      "AdminNetworkView",
      document.getElementById("admin-network")
      );
      this.renderd = true;
  },

  detached: function () {
    this.svelteComponent.$destroy();
  },
};
