frappe.ui.form.on('Sales Order', {
    refresh(frm) {
        if (flt(frm.doc.per_billed, 2) < 100 && frappe.model.can_create("Sales Invoice")) {
            frm.add_custom_button(
                __("Sales Invoice"),
                () => frm.events.make_sales_invoice(frm),
                __("Create")
            );
        }
    },
    make_sales_invoice: function(frm) {
        frappe.model.open_mapped_doc({
            method: "rrchem.override.sales_order.make_sales_invoice",
            args: {
                source_name: frm.doc.name  // Pass the Sales Order name here
            },
            frm: frm
        });
    }
});
