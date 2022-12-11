module.exports = {
    template: "#network-view-template",

    attached: function() {
        this.svelteComponent = SvelteComponents.createComponent(
            "AdminNetworkView",
            document.getElementById("admin-network")
        );
    },

    detached: function() {
        this.svelteComponent.$destroy();
    }
};
