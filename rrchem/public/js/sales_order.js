frappe.ui.form.on('Sales Order', {
    refresh(frm) {
        // Add Sales Invoice button if the order is not fully billed and the user has permission to create a Sales Invoice
        if (flt(frm.doc.per_billed, 2) < 100 && frappe.model.can_create("Sales Invoice")) {
            frm.add_custom_button(
                __("Sales Invoice"),
                () => frm.events.make_sales_invoice(frm),
                __("Create")
            );
        }

        // Add Update Items button if the document is submitted, not closed, and not fully delivered or billed
        if (
            frm.doc.docstatus === 1 &&
            frm.doc.status !== "Closed" &&
            flt(frm.doc.per_delivered, 2) < 100 &&
            flt(frm.doc.per_billed, 2) < 100 &&
            frm.has_perm("write")
        ) {
            frm.add_custom_button(__("Update Items"), () => {
                console.log("hello");

                update_sales_order_items({
                    frm: frm,
                    child_docname: "items",
                    child_doctype: "Sales Order Detail",
                    cannot_add_row: false,
                    has_reserved_stock: frm.doc.__onload && frm.doc.__onload.has_reserved_stock,
                });
            });
        }
    },

    make_sales_invoice(frm) {
        frappe.model.open_mapped_doc({
            method: "rrchem.override.sales_order.make_sales_invoice",
            args: {
                source_name: frm.doc.name  // Pass the Sales Order name here
            },
            frm: frm
        });
    }
});

// Function to update Sales Order items
function update_sales_order_items(opts) {
    const frm = opts.frm;
    const cannot_add_row = typeof opts.cannot_add_row === "undefined" ? true : opts.cannot_add_row;
    const child_meta = frappe.get_meta(`${frm.doc.doctype} Item`);
    const get_precision = (fieldname) => child_meta.fields.find((f) => f.fieldname == fieldname).precision;
    
    const data = frm.doc[opts.child_docname].map((d) => {
        return {
            docname: d.name,
            name: d.name,
            item_code: d.item_code,
            delivery_date: d.delivery_date,
            conversion_factor: d.conversion_factor,
            qty: d.qty,
            rate: d.rate,
            uom: d.uom,
        };
    });

    const fields = [
        {
            fieldtype: "Data",
            fieldname: "docname",
            read_only: 1,
            hidden: 1,
        },
        {
            fieldtype: "Link",
            fieldname: "item_code",
            options: "Item",
            in_list_view: 1,
            read_only: 0,
            disabled: 0,
            label: __("Item Code"),
            get_query: function () {
                let filters;
                if (frm.doc.doctype == "Sales Order") {
                    filters = { is_sales_item: 1 };
                }
                return {
                    query: "erpnext.controllers.queries.item_query",
                    filters: filters,
                };
            },
        },
        {
            fieldtype: "Link",
            fieldname: "uom",
            options: "UOM",
            read_only: 0,
            label: __("UOM"),
            reqd: 1,
            onchange: function () {
                frappe.call({
                    method: "erpnext.stock.get_item_details.get_conversion_factor",
                    args: { item_code: this.doc.item_code, uom: this.value },
                    callback: (r) => {
                        if (!r.exc) {
                            if (this.doc.conversion_factor == r.message.conversion_factor) return;

                            const docname = this.doc.docname;
                            dialog.fields_dict.trans_items.df.data.some((doc) => {
                                if (doc.docname == docname) {
                                    doc.conversion_factor = r.message.conversion_factor;
                                    dialog.fields_dict.trans_items.grid.refresh();
                                    return true;
                                }
                            });
                        }
                    },
                });
            },
        },
        {
            fieldtype: "Float",
            fieldname: "qty",
            default: 0,
            read_only: 0,
            in_list_view: 1,
            label: __("Qty"),
            precision: get_precision("qty"),
        },
        {
            fieldtype: "Currency",
            fieldname: "rate",
            options: "currency",
            default: 0,
            read_only: 0,
            in_list_view: 1,
            label: __("Rate"),
            precision: get_precision("rate"),
        },
    ];

    if (frm.doc.doctype == "Sales Order") {
        fields.splice(2, 0, {
            fieldtype: "Date",
            fieldname: "delivery_date",
            in_list_view: 1,
            label: __("Delivery Date"),
            default: frm.doc.delivery_date,
            reqd: 1,
        });
        fields.splice(3, 0, {
            fieldtype: "Float",
            fieldname: "conversion_factor",
            label: __("Conversion Factor"),
            precision: get_precision("conversion_factor"),
        });
    }

    let dialog = new frappe.ui.Dialog({
        title: __("Update Items"),
        size: "extra-large",
        fields: [
            {
                fieldname: "trans_items",
                fieldtype: "Table",
                label: "Items",
                cannot_add_rows: cannot_add_row,
                in_place_edit: false,
                reqd: 1,
                data: data,
                get_data: () => {
                    return data;
                },
                fields: fields,
            },
        ],
        primary_action: function () {
            if (frm.doctype == "Sales Order" && opts.has_reserved_stock) {
                this.hide();
                frappe.confirm(
                    __(
                        "The reserved stock will be released when you update items. Are you certain you wish to proceed?"
                    ),
                    () => this.update_items()
                );
            } else {
                this.update_items();
            }
        },
        update_items: function () {
            const trans_items = this.get_values()["trans_items"].filter((item) => !!item.item_code);
            
            // Call server-side method to update child qty and rate
            frappe.call({
                method: "erpnext.controllers.accounts_controller.update_child_qty_rate",
                freeze: true,
                args: {
                    parent_doctype: frm.doc.doctype,
                    trans_items: trans_items,
                    parent_doctype_name: frm.doc.name,
                    child_docname: opts.child_docname,
                },
                callback: function () {
                    // Server-side method to update custom_conversion_description field
                    frappe.call({
                        method: "rrchem.override.sales_order.update_custom_conversion_description",
                        args: {
                            sales_order_name: frm.doc.name
                        },
                        callback: function (r) {
                            if (!r.exc) {
                                
                                frm.reload_doc(); // Reload the document to see changes
                            }
                        }
                    });
                }
            });
            this.hide();
            refresh_field("items");
        },
        primary_action_label: __("Update"),
    });

    dialog.show();
}
