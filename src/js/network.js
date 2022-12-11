module.exports = {
  template: "#network-view-template",
  data:function () {
    return {
      renderd: false,
    };
  },

  attached: async function () {
    this.svelteComponent = await SvelteComponents.createComponent(
      "AdminNetworkView",
      document.getElementById("admin-network")
      );
      this.renderd = true;
  },

  detached: function () {
    this.svelteComponent.$destroy();
  },
};
