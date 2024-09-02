frappe.ui.form.on('Lead', {
    refresh: function(frm) {
        if (frm.doc.company) {
            // Call the server-side method to set the default company
            frappe.call({
                method: "frappe.core.doctype.session_default_settings.session_default_settings.set_session_default_values",  // Update with your actual app path
                args: {
                    default_values: {"company":frm.doc.company}
                },
                callback: function(r) {
                    if (r.message) {
                        console.log("Session default company set to:", frm.doc.company);
                    }
                }
            });
        }
    }
});