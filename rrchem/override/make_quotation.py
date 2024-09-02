import frappe
from frappe.model.mapper import get_mapped_doc

@frappe.whitelist()
def make_quotation(source_name, target_doc=None):
    def set_missing_values(source, target):
        # Ensure item_code and uom are properly set
        for item in target.items:
            if not item.item_code:
                item.item_code = frappe.db.get_value('Item', {'item_name': item.item_name}, 'name')
            if not item.uom:
                item.uom = frappe.db.get_value('Item', item.item_code, 'stock_uom')
    
    target_doc = get_mapped_doc(
        "Lead",
        source_name,
        {
            "Lead": {
                "doctype": "Quotation",
                "field_map": {
                    "name": "party_name"
                }
            },
            "Lead Item": {
                "doctype": "Quotation Item",
                "field_map": {
                    
                    "item": "item_code",  # Mapping item field to item_code in Quotation
                    "item_name": "item_name",  # Directly map item_name to Quotation
                    "qty": "qty",  # Mapping quantity field
                },
            },
        },
        target_doc,
        set_missing_values,
    )

    target_doc.quotation_to = "Lead"
    target_doc.run_method("set_missing_values")
    target_doc.run_method("set_other_charges")
    target_doc.run_method("calculate_taxes_and_totals")

    return target_doc


