frappe.ui.form.on('Lead', {
    refresh: function(frm) {
        if (frm.doc.company) {
            
            frappe.call({
                method: "frappe.core.doctype.session_default_settings.session_default_settings.set_session_default_values",  
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

frappe.provide("erpnext");
cur_frm.email_field = "email_id";

erpnext.LeadController = class LeadController extends frappe.ui.form.Controller {
    refresh() {
        let doc = this.frm.doc;

        // Add Quotation button if the Lead is not new and not already a customer
        if (!this.frm.is_new() && doc.__onload && !doc.__onload.is_customer) {
            this.frm.add_custom_button(__("Trial"), this.make_quotation.bind(this), __("Create"));
        }
    }

    make_quotation() {
        frappe.model.open_mapped_doc({
            method: "rrchem.override.make_quotation.make_quotation",  
            frm: this.frm,
        });
    }
};


extend_cscript(cur_frm.cscript, new erpnext.LeadController({ frm: cur_frm }));
