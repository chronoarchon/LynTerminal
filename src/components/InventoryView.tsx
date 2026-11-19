import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  History,
  Edit2,
  Trash2,
  X,
  Zap,
  Tag,
  ArrowLeftRight,
  Printer,
  Boxes,
} from "lucide-react";
import type { Item, Settings, StockMovement, PurchaseOrder } from "../types";
import { api } from "../services/api";
import { useAppleDialog } from "./common/AppleDialog";
import { AppleSelect } from "./common/AppleSelect";
import { useCurrency } from "../context/CurrencyContext";

interface InventoryViewProps {
  items: Item[];
  settings: Settings;
  onRefresh: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  items,
  settings,
  onRefresh,
}) => {
  const { currencySymbol, formatCurrency } = useCurrency();
  const currency = currencySymbol || settings.currency_symbol || "$";
  const { alert, confirm, toast } = useAppleDialog();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedGodown, setSelectedGodown] = useState("All");

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Extended Features
  const [isGeneratingPO, setIsGeneratingPO] = useState(false);
  const [generatedPO, setGeneratedPO] = useState<PurchaseOrder | null>(null);
  const [isShelfTagsOpen, setIsShelfTagsOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferItemId, setTransferItemId] = useState("");
  const [transferFromGodown, setTransferFromGodown] = useState("Main Store");
  const [transferToGodown, setTransferToGodown] = useState("Secondary Godown");
  const [transferQty, setTransferQty] = useState("10");
  const [transferNotes, setTransferNotes] = useState("Restock shelf from godown");
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [stockHistory, setStockHistory] = useState<StockMovement[]>([]);
  const [adjustmentValue, setAdjustmentValue] = useState<string>("");
  const [adjustmentReason, setAdjustmentReason] = useState("Manual Count / Restock");

  // Form state
  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formBarcode, setFormBarcode] = useState("");
  const [formCategory, setFormCategory] = useState("General");
  const [formUnit, setFormUnit] = useState("pcs");
  const [formPurchasePrice, setFormPurchasePrice] = useState("0");
  const [formSalePrice, setFormSalePrice] = useState("0");
  const [formStock, setFormStock] = useState("0");
  const [formMinAlert, setFormMinAlert] = useState("5");
  const [formGodown, setFormGodown] = useState("Main Store");
  const [formSize, setFormSize] = useState("");
  const [formBrand, setFormBrand] = useState("");

  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(items.map((i) => i.category))).filter(Boolean)];
  }, [items]);

  const godowns = useMemo(() => {
    return ["All", ...Array.from(new Set(items.map((i) => i.godown))).filter(Boolean)];
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return items.filter((item) => {
      const matchesCat = selectedCategory === "All" || item.category === selectedCategory;
      const matchesGodown = selectedGodown === "All" || item.godown === selectedGodown;
      if (!matchesCat || !matchesGodown) return false;
      if (!term) return true;
      return (
        item.name.toLowerCase().includes(term) ||
        item.sku.toLowerCase().includes(term) ||
        item.barcode.toLowerCase().includes(term) ||
        (item.brand && item.brand.toLowerCase().includes(term))
      );
    });
  }, [items, searchTerm, selectedCategory, selectedGodown]);

  const openCreateModal = () => {
    setActiveItem(null);
    setFormName("");
    setFormSku("");
    setFormBarcode("");
    setFormCategory("General");
    setFormUnit("pcs");
    setFormPurchasePrice("0");
    setFormSalePrice("0");
    setFormStock("0");
    setFormMinAlert("5");
    setFormGodown("Main Store");
    setFormSize("");
    setFormBrand("");
    setIsEditModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    setActiveItem(item);
    setFormName(item.name);
    setFormSku(item.sku);
    setFormBarcode(item.barcode);
    setFormCategory(item.category);
    setFormUnit(item.unit);
    setFormPurchasePrice(item.purchase_price.toString());
    setFormSalePrice(item.sale_price.toString());
    setFormStock(item.stock_quantity.toString());
    setFormMinAlert(item.min_stock_alert.toString());
    setFormGodown(item.godown);
    setFormSize(item.size || "");
    setFormBrand(item.brand || "");
    setIsEditModalOpen(true);
  };

  const openAdjustModal = (item: Item) => {
    setActiveItem(item);
    setAdjustmentValue("");
    setAdjustmentReason("Inventory Count / Restock");
    setIsAdjustModalOpen(true);
  };

  const openHistoryModal = async (item: Item) => {
    setActiveItem(item);
    try {
      const history = await api.getStockMovements(item.id);
      setStockHistory(history);
      setIsHistoryModalOpen(true);
    } catch (err) {
      alert("Failed to load history: " + err);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    try {
      const itemToSave: Item = {
        id: activeItem ? activeItem.id : "",
        name: formName.trim(),
        sku: formSku.trim(),
        barcode: formBarcode.trim(),
        category: formCategory.trim() || "General",
        unit: formUnit.trim() || "pcs",
        purchase_price: parseFloat(formPurchasePrice) || 0,
        sale_price: parseFloat(formSalePrice) || 0,
        stock_quantity: parseFloat(formStock) || 0,
        min_stock_alert: parseFloat(formMinAlert) || 5,
        godown: formGodown.trim() || "Main Store",
        size: formSize.trim() || null,
        brand: formBrand.trim() || null,
        created_at: activeItem ? activeItem.created_at : "",
      };

      await api.saveItem(itemToSave);
      setIsEditModalOpen(false);
      onRefresh();
    } catch (err) {
      alert("Failed to save product: " + err);
    }
  };

  const handleAutoGeneratePO = async () => {
    try {
      setIsGeneratingPO(true);
      const po = await api.generateLowStockPO();
      setGeneratedPO(po);
      onRefresh();
    } catch (err) {
      alert("PO Generation: " + err);
    } finally {
      setIsGeneratingPO(false);
    }
  };

  const handleOpenTransferModal = (item?: Item) => {
    if (item) {
      setTransferItemId(item.id);
      setTransferFromGodown(item.godown);
    } else if (items.length > 0) {
      setTransferItemId(items[0].id);
      setTransferFromGodown(items[0].godown);
    }
    setTransferToGodown("Secondary Godown");
    setTransferQty("10");
    setIsTransferModalOpen(true);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferItemId) return;
    const qty = parseFloat(transferQty);
    if (isNaN(qty) || qty <= 0) {
      alert("Please enter a valid transfer quantity.");
      return;
    }
    try {
      setIsSubmittingTransfer(true);
      await api.transferGodownStock({
        item_id: transferItemId,
        from_godown: transferFromGodown,
        to_godown: transferToGodown,
        quantity: qty,
        notes: transferNotes,
      });
      setIsTransferModalOpen(false);
      onRefresh();
    } catch (err) {
      alert("Transfer failed: " + err);
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleApplyAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    const adj = parseFloat(adjustmentValue);
    if (isNaN(adj) || adj === 0) return;

    try {
      await api.adjustStock(activeItem.id, adj, adjustmentReason);
      setIsAdjustModalOpen(false);
      onRefresh();
    } catch (err) {
      alert("Failed to adjust stock: " + err);
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    const ok = await confirm({
      title: "Delete Product",
      message: `Are you sure you want to delete ${name}? This action cannot be undone.`,
      confirmText: "Delete",
      isDestructive: true,
    });
    if (ok) {
      try {
        await api.deleteItem(id);
        toast({ message: `Product "${name}" deleted`, type: "success" });
        onRefresh();
      } catch (err) {
        alert({ title: "Delete Failed", message: String(err), type: "error" });
      }
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto select-none">
      
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.07]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F]">
            Inventory & Stock
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            {items.length} products cataloged across warehouse locations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleAutoGeneratePO}
            disabled={isGeneratingPO}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold shadow-2xs transition apple-press cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-[#FF9500]" />
            <span>{isGeneratingPO ? "Generating..." : "Auto Restock PO"}</span>
          </button>

          <button
            onClick={() => setIsShelfTagsOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F] text-xs font-semibold shadow-2xs transition apple-press cursor-pointer"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Shelf Tags</span>
          </button>

          <button
            onClick={() => handleOpenTransferModal()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F] text-xs font-semibold shadow-2xs transition apple-press cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Transfer</span>
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold shadow-xs transition apple-press cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Product</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl apple-card shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products by name, SKU, or barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl pl-10 pr-3 py-1.5 text-xs text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:border-black"
          />
        </div>

        <div className="flex items-center gap-2">
          <AppleSelect
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={categories.map((c) => ({ value: c, label: `Category: ${c}` }))}
            className="w-44"
            buttonClassName="bg-[#F5F5F7] py-1.5"
          />

          {settings.enable_godowns && (
            <AppleSelect
              value={selectedGodown}
              onChange={setSelectedGodown}
              options={godowns.map((g) => ({ value: g, label: `Location: ${g}` }))}
              className="w-44"
              buttonClassName="bg-[#F5F5F7] py-1.5"
            />
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block apple-card rounded-2xl overflow-hidden shadow-2xs">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-black/[0.06] bg-[#FBFBFC] text-[#86868B] font-semibold text-[11px]">
              <th className="py-3 px-4">Product</th>
              <th className="py-3 px-3">SKU / Barcode</th>
              <th className="py-3 px-3">Category</th>
              <th className="py-3 px-3 text-right">Cost</th>
              <th className="py-3 px-3 text-right">Price</th>
              <th className="py-3 px-3 text-center">Stock Level</th>
              {settings.enable_godowns && <th className="py-3 px-3">Godown</th>}
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {filteredItems.map((item) => {
              const isLow = item.stock_quantity <= item.min_stock_alert;

              return (
                <tr key={item.id} className="hover:bg-[#FBFBFC] transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-[#1D1D1F]">{item.name}</div>
                    {item.size && (
                      <div className="text-[10px] text-[#86868B]">Size: {item.size}</div>
                    )}
                  </td>
                  <td className="py-3.5 px-3 font-mono text-[11px] text-[#6E6E73]">
                    <div>{item.sku || "—"}</div>
                    {item.barcode && (
                      <div className="text-[10px] text-[#86868B]">{item.barcode}</div>
                    )}
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="px-2 py-0.5 rounded-md bg-black/[0.04] text-[11px] font-medium text-[#6E6E73]">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-[#6E6E73]">
                    {formatCurrency(item.purchase_price)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-semibold text-[#1D1D1F]">
                    {formatCurrency(item.sale_price)}
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold ${
                        isLow
                          ? "bg-[#FF3B30]/10 text-[#FF3B30]"
                          : "bg-[#34C759]/10 text-[#34C759]"
                      }`}
                    >
                      {item.stock_quantity} {item.unit}
                    </span>
                  </td>
                  {settings.enable_godowns && (
                    <td className="py-3.5 px-3 text-[#6E6E73] text-[11px]">
                      {item.godown}
                    </td>
                  )}
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => openAdjustModal(item)}
                        title="Adjust Stock"
                        className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] transition"
                      >
                        <Zap className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openHistoryModal(item)}
                        title="Audit Stock Movements"
                        className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] transition"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEditModal(item)}
                        title="Edit Item"
                        className="p-1.5 rounded-lg text-[#6E6E73] hover:text-black hover:bg-black/[0.05] transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        title="Delete Item"
                        className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#FF3B30] hover:bg-black/[0.05] transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View (< md) */}
      <div className="md:hidden space-y-2.5">
        {filteredItems.map((item) => {
          const isLow = item.stock_quantity <= item.min_stock_alert;

          return (
            <div
              key={item.id}
              className="apple-card p-3.5 rounded-2xl flex flex-col gap-2.5 shadow-2xs"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-xs text-[#1D1D1F]">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-[#86868B] font-mono mt-0.5">
                    {item.sku || "No SKU"} · {item.category}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                    isLow ? "bg-[#FF3B30]/10 text-[#FF3B30]" : "bg-[#34C759]/10 text-[#34C759]"
                  }`}
                >
                  {item.stock_quantity} {item.unit}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-black/[0.04] text-xs">
                <div>
                  <span className="text-[10px] text-[#86868B] block">Price</span>
                  <span className="font-bold font-mono text-[#1D1D1F]">
                    {formatCurrency(item.sale_price)}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openAdjustModal(item)}
                    className="px-2.5 py-1 rounded-lg bg-[#F5F5F7] text-[11px] font-medium text-[#1D1D1F]"
                  >
                    Adjust
                  </button>
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-1.5 rounded-lg text-[#6E6E73] hover:text-black"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="py-16 text-center text-[#86868B]">
          <Boxes className="w-8 h-8 mx-auto text-[#86868B]/40 mb-2" />
          <p className="text-xs font-semibold text-[#1D1D1F]">No products found</p>
          <p className="text-[11px] text-[#86868B] mt-0.5">
            Try adjusting your search query or category filters
          </p>
        </div>
      )}

      {/* CREATE / EDIT ITEM MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-black/[0.08] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB]">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  {activeItem ? "Edit Product" : "New Product"}
                </h3>
                <p className="text-[11px] text-neutral-400">
                  SKU, price, barcode &amp; location
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic Oat Milk 1L"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. OAT-100"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Barcode / EAN
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 789123456789"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Beverages"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    placeholder="pcs, kg, box"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Cost Price ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formPurchasePrice}
                    onChange={(e) => setFormPurchasePrice(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Sale Price ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formSalePrice}
                    onChange={(e) => setFormSalePrice(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Low Stock Alert
                  </label>
                  <input
                    type="number"
                    value={formMinAlert}
                    onChange={(e) => setFormMinAlert(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-black/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full border border-black/[0.1] text-xs font-semibold text-black bg-white hover:bg-neutral-100 cursor-pointer shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK ADJUSTMENT MODAL */}
      {isAdjustModalOpen && activeItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-black/[0.08] overflow-visible animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB] rounded-t-3xl">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  Adjust Stock
                </h3>
                <p className="text-[11px] text-neutral-400">{activeItem.name}</p>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyAdjustment} className="p-5 space-y-3.5">
              <div className="p-3 rounded-xl bg-white border border-black/[0.08] text-xs flex justify-between items-center">
                <span className="text-neutral-400">Current Stock:</span>
                <span className="font-mono font-bold text-black">
                  {activeItem.stock_quantity} {activeItem.unit}
                </span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Change (+ / -) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. +10 or -3"
                  value={adjustmentValue}
                  onChange={(e) => setAdjustmentValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-bold text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Reason
                </label>
                <AppleSelect
                  value={adjustmentReason}
                  onChange={setAdjustmentReason}
                  options={[
                    "Manual Count / Restock",
                    "Damaged Goods / Spoilage",
                    "Theft or Missing",
                    "Store Demo / Sample",
                    "Supplier Return",
                  ]}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full border border-black/[0.1] text-xs font-semibold text-black bg-white hover:bg-neutral-100 cursor-pointer shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer"
                >
                  Apply Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK MOVEMENTS HISTORY MODAL */}
      {isHistoryModalOpen && activeItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-black/[0.08] overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB]">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  Stock Log
                </h3>
                <p className="text-[11px] text-neutral-400">{activeItem.name}</p>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
              {stockHistory.map((mov) => {
                const isPositive = mov.change_quantity > 0;

                return (
                  <div
                    key={mov.id}
                    className="p-3 rounded-xl border border-black/[0.08] bg-white flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-black">
                        {mov.movement_type} · {mov.reference_id}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        {new Date(mov.timestamp).toLocaleString()} · {mov.notes}
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`font-mono font-bold text-xs ${
                          isPositive ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {isPositive ? `+${mov.change_quantity}` : mov.change_quantity}
                      </span>
                      <div className="text-[10px] text-neutral-400 font-mono">
                        Bal: {mov.quantity_after}
                      </div>
                    </div>
                  </div>
                );
              })}

              {stockHistory.length === 0 && (
                <div className="text-center py-12 text-neutral-400 text-xs">
                  No movement records found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LOW STOCK PURCHASE ORDER MODAL */}
      {generatedPO && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-black/[0.08] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-black/5 text-black flex items-center justify-center border border-black/[0.08]">
                  <Zap className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-black tracking-tight">
                    Purchase Order
                  </h3>
                  <p className="text-[11px] text-neutral-400 font-mono">{generatedPO.po_number}</p>
                </div>
              </div>
              <button
                onClick={() => setGeneratedPO(null)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div className="p-3.5 rounded-2xl bg-white border border-black/[0.08] space-y-1.5 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span>Vendor:</span>
                  <span className="font-semibold text-black">{generatedPO.vendor_name}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Restock Count:</span>
                  <span className="font-bold text-black">{generatedPO.items_count} items</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Estimated Total:</span>
                  <span className="font-bold font-mono text-black">
                    {formatCurrency(generatedPO.total_cost)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 rounded-full border border-black/[0.1] text-xs font-semibold text-black bg-white hover:bg-neutral-100 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print PO</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGeneratedPO(null)}
                  className="flex-1 py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GODOWN TRANSFER MODAL */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-black/[0.08] overflow-visible animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB] rounded-t-3xl">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  Stock Transfer
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Move inventory between locations
                </p>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="p-5 space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Product *
                </label>
                <AppleSelect
                  value={transferItemId}
                  onChange={(val) => {
                    setTransferItemId(val);
                    const it = items.find((i) => i.id === val);
                    if (it) setTransferFromGodown(it.godown);
                  }}
                  options={items.map((it) => ({
                    value: it.id,
                    label: `${it.name} (${it.stock_quantity} ${it.unit} in ${it.godown})`,
                  }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    From Location
                  </label>
                  <input
                    type="text"
                    value={transferFromGodown}
                    onChange={(e) => setTransferFromGodown(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    To Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={transferToGodown}
                    onChange={(e) => setTransferToGodown(e.target.value)}
                    placeholder="e.g. Counter Shelf"
                    className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Transfer Quantity *
                </label>
                <input
                  type="number"
                  required
                  min="0.1"
                  step="any"
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-bold text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Restock shelf"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full border border-black/[0.1] text-xs font-semibold text-black bg-white hover:bg-neutral-100 cursor-pointer shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  className="flex-1 py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer"
                >
                  {isSubmittingTransfer ? "Transferring..." : "Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHELF PRICE TAGS MODAL */}
      {isShelfTagsOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-black/[0.08] overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB] no-print">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  Shelf Price Tags
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Print-ready product shelf tags
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print All</span>
                </button>
                <button
                  onClick={() => setIsShelfTagsOpen(false)}
                  className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 gap-3.5 bg-white select-text">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-dashed border-black/20 flex flex-col justify-between h-28 text-center"
                >
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-[#86868B]">
                      {settings.business_name}
                    </div>
                    <div className="font-bold text-xs text-[#1D1D1F] line-clamp-1 mt-0.5">
                      {item.name}
                    </div>
                  </div>

                  <div>
                    <div className="text-base font-bold font-mono text-[#1D1D1F]">
                      {formatCurrency(item.sale_price)}
                    </div>
                    <div className="text-[9px] font-mono text-[#86868B]">
                      SKU: {item.sku || "N/A"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
