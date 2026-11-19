import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  DollarSign,
  CreditCard,
  Smartphone,
  ChevronDown,
  X,
  ShoppingCart,
  Boxes,
  UserPlus,
  Building,
  Users,
  AlertCircle,
  Lock,
  ExternalLink,
} from "lucide-react";
import type { Item, Party, Settings, InvoicePayload, InvoiceDetail, LicenseStatus } from "../types";
import { api } from "../services/api";
import { InvoiceDocModal } from "./InvoiceDocModal";
import { useAppleDialog } from "./common/AppleDialog";
import { useCurrency } from "../context/CurrencyContext";

interface POSBillingProps {
  settings: Settings;
  items: Item[];
  parties: Party[];
  licenseStatus?: LicenseStatus | null;
  onInvoiceCreated: () => void;
  onRefreshData: () => void;
  onOpenLicenseModal?: () => void;
}


interface CartItem {
  item_id: string;
  item_name: string;
  sku: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
}

export const POSBilling: React.FC<POSBillingProps> = ({
  settings,
  items,
  parties,
  licenseStatus,
  onInvoiceCreated,
  onRefreshData,
  onOpenLicenseModal,
}) => {
  const { currencySymbol, formatCurrency } = useCurrency();
  const currency = currencySymbol || settings.currency_symbol || "$";
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Bill Mode: SALE, QUOTATION, PURCHASE
  const [billMode, setBillMode] = useState<"SALE" | "QUOTATION" | "PURCHASE">("SALE");

  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [customCustomerName, setCustomCustomerName] = useState("");

  // Payment methods: CASH, CARD, CUSTOM_1, CUSTOM_2, CREDIT
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "CUSTOM_1" | "CUSTOM_2" | "CREDIT">("CASH");
  const [isHalfCredit, setIsHalfCredit] = useState(false);
  const [creditPaidAmount, setCreditPaidAmount] = useState<string>("");
  const [creditPaidMethod, setCreditPaidMethod] = useState<string>("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [tenderedAmount, setTenderedAmount] = useState<string>("");
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Optional preview modal
  const [previewAfterSale, setPreviewAfterSale] = useState<boolean>(() => {
    return settings.preview_after_sale || localStorage.getItem("lynterminal_pos_preview") === "true" || localStorage.getItem("lyndesk_pos_preview") === "true";
  });
  const [completedInvoice, setCompletedInvoice] = useState<InvoiceDetail | null>(null);
  const [successToast, setSuccessToast] = useState<{
    number: string;
    total: number;
    detail: InvoiceDetail;
  } | null>(null);

  // Mobile Active View: 'catalog' | 'cart'
  const [mobileView, setMobileView] = useState<"catalog" | "cart">("catalog");

  // Quick Add Product Modal State
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickProduct, setQuickProduct] = useState({
    name: "",
    size: "",
    brand: "",
    category: "General",
    sale_price: "",
    purchase_price: "",
    tax_rate: "",
    stock_quantity: "50",
    unit: "pcs",
  });
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  // Split Payment
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitCash, setSplitCash] = useState<string>("");
  const [splitCard, setSplitCard] = useState<string>("");

  const [isCustomerMenuOpen, setIsCustomerMenuOpen] = useState(false);
  const customerMenuRef = useRef<HTMLDivElement>(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const { alert: appleAlert, toast: appleToast } = useAppleDialog();
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (customerMenuRef.current && !customerMenuRef.current.contains(e.target as Node)) {
        setIsCustomerMenuOpen(false);
      }
    };
    if (isCustomerMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isCustomerMenuOpen]);

  const handleTogglePreview = (val: boolean) => {
    setPreviewAfterSale(val);
    localStorage.setItem("lynterminal_pos_preview", val ? "true" : "false");
  };

  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(items.map((i) => i.category))).filter(Boolean)];
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return items.filter((item) => {
      const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!term) return true;
      return (
        item.name.toLowerCase().includes(term) ||
        item.sku.toLowerCase().includes(term) ||
        item.barcode.includes(term) ||
        (item.brand && item.brand.toLowerCase().includes(term)) ||
        (item.size && item.size.toLowerCase().includes(term))
      );
    });
  }, [items, searchTerm, selectedCategory]);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;

    const exactMatch = items.find(
      (i) =>
        i.barcode.toLowerCase() === query.toLowerCase() ||
        i.sku.toLowerCase() === query.toLowerCase()
    );

    if (exactMatch) {
      addToCart(exactMatch);
      setSearchTerm("");
    } else {
      setQuickProduct((prev) => ({ ...prev, name: query }));
      setShowQuickAddModal(true);
    }
  };

  const addToCart = (item: Item) => {
    const isPurchase = billMode === "PURCHASE";
    const unitPrice = isPurchase ? item.purchase_price : item.sale_price;

    setCart((prev) => {
      const existing = prev.find((ci) => ci.item_id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.item_id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [
        ...prev,
        {
          item_id: item.id,
          item_name: item.name + (item.size ? ` (${item.size})` : ""),
          sku: item.sku,
          quantity: 1,
          unit: item.unit,
          unit_price: unitPrice,
          discount_percent: 0,
          tax_rate: isPurchase ? 0 : (item.tax_rate ?? settings.default_tax_rate),
        },
      ];
    });
  };

  const updateItemPrice = (itemId: string, newPrice: number) => {
    setCart((prev) =>
      prev.map((ci) =>
        ci.item_id === itemId ? { ...ci, unit_price: Math.max(0, newPrice) } : ci
      )
    );
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) => {
          if (ci.item_id === itemId) {
            const newQty = ci.quantity + delta;
            return newQty > 0 ? { ...ci, quantity: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.item_id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setTenderedAmount("");
    setReferenceNumber("");
    setNotes("");
    setSelectedPartyId("");
    setCustomCustomerName("");
    setIsSplitPayment(false);
    setSplitCash("");
    setSplitCard("");
  };

  // Tax calculations
  const isTaxInclusive = settings.tax_mode === "INCLUSIVE";
  const rawSubtotal = cart.reduce((sum, item) => {
    return sum + item.unit_price * item.quantity * (1 - item.discount_percent / 100);
  }, 0);

  const taxableAmount = Math.max(0, rawSubtotal - discountAmount);
  let taxAmount = 0;
  let totalAmount = 0;
  let displaySubtotal = 0;

  if (isTaxInclusive) {
    totalAmount = taxableAmount;
    taxAmount = (taxableAmount * settings.default_tax_rate) / (100 + settings.default_tax_rate);
    displaySubtotal = totalAmount - taxAmount;
  } else {
    displaySubtotal = taxableAmount;
    taxAmount = (taxableAmount * settings.default_tax_rate) / 100;
    totalAmount = taxableAmount + taxAmount;
  }

  const tenderedNum = parseFloat(tenderedAmount) || totalAmount;
  const changeDue = Math.max(0, tenderedNum - totalAmount);
  const totalCartCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) {
      appleToast({ message: "Customer name is required", type: "error" });
      return;
    }
    try {
      setIsSavingCustomer(true);
      const isVendor = billMode === "PURCHASE";
      const created = await api.saveParty({
        id: "",
        name: newCustomerForm.name.trim(),
        party_type: isVendor ? "VENDOR" : "CUSTOMER",
        phone: newCustomerForm.phone.trim(),
        email: newCustomerForm.email.trim(),
        address: newCustomerForm.address.trim(),
        tax_number: "",
        opening_balance: 0,
        current_balance: 0,
        created_at: new Date().toISOString(),
      });
      onRefreshData();
      setSelectedPartyId(created.id);
      setShowAddCustomerModal(false);
      setNewCustomerForm({ name: "", phone: "", email: "", address: "" });
      appleToast({
        message: `${isVendor ? "Supplier" : "Customer"} "${created.name}" saved & selected`,
        type: "success",
      });
    } catch (err) {
      appleAlert({ title: "Failed to Save Contact", message: String(err), type: "error" });
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickProduct.name.trim() || !quickProduct.sale_price) {
      appleAlert({ title: "Required Fields", message: "Please provide product name and sale price", type: "warning" });
      return;
    }
    setIsQuickAdding(true);

    try {
      const createdItem = await api.quickCreateProduct({
        name: quickProduct.name.trim(),
        size: quickProduct.size.trim() || null,
        brand: quickProduct.brand.trim() || null,
        sale_price: parseFloat(quickProduct.sale_price) || 0,
        purchase_price: quickProduct.purchase_price ? parseFloat(quickProduct.purchase_price) : null,
        category: quickProduct.category.trim() || "General",
        tax_rate: quickProduct.tax_rate !== "" ? parseFloat(quickProduct.tax_rate) : null,
        stock_quantity: parseFloat(quickProduct.stock_quantity) || 50,
        unit: quickProduct.unit.trim() || "pcs",
      });

      addToCart(createdItem);
      onRefreshData();
      setShowQuickAddModal(false);
      setQuickProduct({
        name: "",
        size: "",
        brand: "",
        category: "General",
        sale_price: "",
        purchase_price: "",
        tax_rate: "",
        stock_quantity: "50",
        unit: "pcs",
      });
      setSearchTerm("");
    } catch (err) {
      appleAlert({ title: "Product Creation Failed", message: String(err), type: "error" });
    } finally {
      setIsQuickAdding(false);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    if (licenseStatus?.is_expired) {
      onOpenLicenseModal?.();
      appleAlert({
        title: "14-Day Free Trial Expired",
        message: "Your evaluation trial has ended. Please activate your commercial license to complete checkout and issue new bills.",
        type: "warning",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const today = new Date().toISOString().split("T")[0];
      const selectedParty = parties.find((p) => p.id === selectedPartyId);
      const isPurchase = billMode === "PURCHASE";
      const isQuotation = billMode === "QUOTATION";

      const defaultPartyName = isPurchase
        ? "Supplier Direct Inward"
        : "Walk-in Customer";
      const partyName = selectedParty
        ? selectedParty.name
        : customCustomerName.trim() || defaultPartyName;

      if (isQuotation) {
        const quoteItems = cart.map((ci) => {
          const lineTotal = ci.unit_price * ci.quantity * (1 - ci.discount_percent / 100);
          return {
            item_id: ci.item_id,
            item_name: ci.item_name,
            quantity: ci.quantity,
            unit: ci.unit,
            unit_price: ci.unit_price,
            discount_percent: ci.discount_percent,
            tax_rate: ci.tax_rate,
            line_total: Math.round(lineTotal * 100) / 100,
          };
        });

        await api.createEstimate({
          party_id: selectedPartyId ? selectedPartyId : null,
          party_name: partyName,
          estimate_date: today,
          expiry_date: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
          items: quoteItems,
          notes: notes || "Quotation valid for 15 days.",
        });

        clearCart();
        onInvoiceCreated();
        onRefreshData();
        setMobileView("catalog");
        return;
      }

      let effectivePaid = Math.round(totalAmount * 100) / 100;
      let paymentMethodDesc = "Cash";

      if (isPurchase) {
        paymentMethodDesc = paymentMethod === "CARD" ? "Bank Wire" : "Cash";
      } else if (isSplitPayment) {
        const cVal = parseFloat(splitCash) || 0;
        const cardVal = parseFloat(splitCard) || Math.max(0, totalAmount - cVal);
        paymentMethodDesc = `Split (${currency}${cVal.toFixed(2)} Cash + ${currency}${cardVal.toFixed(2)} Card)`;
      } else if (paymentMethod === "CARD") {
        paymentMethodDesc = "Card";
      } else if (paymentMethod === "CUSTOM_1") {
        paymentMethodDesc = settings.custom_payment_1_name || "Custom 1";
      } else if (paymentMethod === "CUSTOM_2") {
        paymentMethodDesc = settings.custom_payment_2_name || "Custom 2";
      } else if (paymentMethod === "CREDIT") {
        if (!selectedPartyId) {
          setShowAddCustomerModal(true);
          appleAlert({
            title: "Customer Selection Required",
            message: "Credit billing requires customer details (name and phone). Please select or register a customer.",
            type: "warning",
          });
          setIsSubmitting(false);
          return;
        }

        if (isHalfCredit) {
          const partial = parseFloat(creditPaidAmount) || 0;
          effectivePaid = Math.min(totalAmount, Math.max(0, Math.round(partial * 100) / 100));
          const remCredit = Math.round((totalAmount - effectivePaid) * 100) / 100;
          paymentMethodDesc = `Partial Credit (${currency}${effectivePaid.toFixed(2)} ${creditPaidMethod} + ${currency}${remCredit.toFixed(2)} Credit)`;
        } else {
          effectivePaid = 0;
          paymentMethodDesc = "Credit";
        }
      }

      const payload: InvoicePayload = {
        invoice_type: isPurchase ? "PURCHASE" : "SALE",
        party_id: selectedPartyId ? selectedPartyId : null,
        party_name: partyName,
        invoice_date: today,
        due_date: today,
        subtotal: Math.round(displaySubtotal * 100) / 100,
        discount_amount: Math.round(discountAmount * 100) / 100,
        tax_amount: isPurchase ? 0 : Math.round(taxAmount * 100) / 100,
        total_amount: Math.round(totalAmount * 100) / 100,
        paid_amount: effectivePaid,
        payment_method: paymentMethodDesc,
        notes: notes || (paymentMethod === "CREDIT" ? "Customer Credit Bill" : (isPurchase ? "Purchase Inward" : "Counter Sale")),
        reference: referenceNumber.trim() || null,
        items: cart.map((ci) => {
          const lineTotal = ci.unit_price * ci.quantity * (1 - ci.discount_percent / 100);
          return {
            item_id: ci.item_id,
            item_name: ci.item_name,
            quantity: ci.quantity,
            unit: ci.unit,
            unit_price: ci.unit_price,
            discount_percent: ci.discount_percent,
            tax_rate: isPurchase ? 0 : ci.tax_rate,
            line_total: Math.round(lineTotal * 100) / 100,
          };
        }),
      };

      const invoiceDetail = await api.createInvoice(payload);

      setSuccessToast({
        number: invoiceDetail.invoice.invoice_number,
        total: invoiceDetail.invoice.total_amount,
        detail: invoiceDetail,
      });

      if (previewAfterSale) {
        setCompletedInvoice(invoiceDetail);
      }

      clearCart();
      onInvoiceCreated();
      onRefreshData();
      setMobileView("catalog");
      barcodeInputRef.current?.focus();
    } catch (err) {
      appleAlert({ title: "Checkout Error", message: String(err), type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-[#F5F5F7] overflow-hidden relative select-none">
      {/* 14-Day Free Trial Expired Warning Banner */}
      {licenseStatus?.is_expired && (
        <div className="w-full bg-rose-50 border-b border-rose-200 px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 z-30 shrink-0">
          <div className="flex items-center gap-2 text-xs text-rose-800 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>14-Day Free Trial Expired — Counter billing is locked until activated. Past sales and records remain safe.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://lynterminal.wintershogun.tech/pricing?checkout=windows"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 text-xs font-semibold shadow-2xs transition apple-press cursor-pointer"
            >
              <span>Buy Commercial License</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={onOpenLicenseModal}
              className="px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs transition apple-press cursor-pointer"
            >
              Activate Key
            </button>
          </div>
        </div>
      )}

      
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-16 right-4 sm:right-8 z-50 bg-[#1D1D1F] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-white/10 animate-in slide-in-from-top duration-200">
          <div className="w-6 h-6 rounded-full bg-[#34C759]/20 text-[#34C759] flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white">
              Sale Completed · {successToast.number}
            </div>
            <div className="text-[11px] text-[#A1A1A6]">
              {formatCurrency(successToast.total)} recorded
            </div>
          </div>
          <button
            onClick={() => setCompletedInvoice(successToast.detail)}
            className="ml-2 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white font-medium transition apple-press"
          >
            Receipt
          </button>
          <button
            onClick={() => setSuccessToast(null)}
            className="w-5 h-5 rounded-md text-[#86868B] hover:text-white flex items-center justify-center ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Mobile Top Segmented Switcher (Products vs Cart) */}
      <div className="lg:hidden flex items-center justify-between p-3 bg-white border-b border-black/[0.07] shrink-0">
        <div className="flex items-center p-0.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] w-full max-w-xs mx-auto">
          <button
            onClick={() => setMobileView("catalog")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
              mobileView === "catalog"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#86868B]"
            }`}
          >
            Catalog ({items.length})
          </button>
          <button
            onClick={() => setMobileView("cart")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
              mobileView === "cart"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#86868B]"
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Ticket ({totalCartCount})</span>
            {totalCartCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-black" />
            )}
          </button>
        </div>
      </div>

      {/* LEFT COLUMN: Product Catalog & Search */}
      <div
        className={`flex-1 flex flex-col bg-white border-r border-black/[0.07] overflow-hidden ${
          mobileView === "cart" ? "hidden lg:flex" : "flex"
        }`}
      >
        {/* Search, Barcode Input & Quick Item */}
        <div className="p-3.5 border-b border-black/[0.06] flex items-center gap-2.5 bg-white shrink-0">
          <form onSubmit={handleBarcodeSubmit} className="relative flex-1">
            <Search className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Search product, SKU, or scan barcode [Enter]..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 rounded-xl bg-[#F5F5F7] border border-black/[0.06] text-xs font-medium text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition"
            />
            <Barcode className="w-4 h-4 text-[#86868B] absolute right-3.5 top-1/2 -translate-y-1/2" />
          </form>

          <button
            type="button"
            onClick={() => {
              setQuickProduct((prev) => ({ ...prev, name: searchTerm }));
              setShowQuickAddModal(true);
            }}
            className="px-3 py-2 rounded-xl bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs shrink-0 transition apple-press"
            title="Add uncataloged product immediately"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ Product</span>
          </button>
        </div>

        {/* Category Pills */}
        <div className="px-4 py-2 flex items-center gap-1.5 overflow-x-auto border-b border-black/[0.05] bg-[#FBFBFC] shrink-0 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition apple-press ${
                selectedCategory === cat
                  ? "bg-[#1D1D1F] text-white shadow-2xs font-semibold"
                  : "bg-white text-[#6E6E73] hover:text-[#1D1D1F] border border-black/[0.06]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 content-start pb-20 lg:pb-6">
          {filteredItems.map((item) => {
            const isLowStock = item.stock_quantity <= item.min_stock_alert;
            const inCart = cart.find((ci) => ci.item_id === item.id);

            return (
              <div
                key={item.id}
                onClick={() => addToCart(item)}
                className={`group relative p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-[135px] sm:h-[148px] apple-press ${
                  inCart
                    ? "bg-black/[0.04] border-black shadow-xs"
                    : "bg-white hover:bg-[#FBFBFC] border-black/[0.07] hover:border-black/[0.14] shadow-2xs"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="font-semibold text-xs text-[#1D1D1F] line-clamp-2 leading-tight">
                      {item.name}
                      {item.size && (
                        <span className="text-[#86868B] font-normal ml-1">({item.size})</span>
                      )}
                    </span>
                    {inCart && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-black text-white text-[10px] font-bold">
                        {inCart.quantity}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#86868B] font-mono truncate">
                    {item.sku || "No SKU"}
                  </div>
                </div>

                <div className="flex items-end justify-between pt-1 border-t border-black/[0.04]">
                  <div>
                    <span className="text-[10px] text-[#86868B] block">
                      {billMode === "PURCHASE" ? "Cost" : "Price"}
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-[#1D1D1F]">
                      {formatCurrency(billMode === "PURCHASE" ? item.purchase_price : item.sale_price)}
                    </span>
                  </div>

                  <span
                    className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                      isLowStock
                        ? "bg-[#FF3B30]/10 text-[#FF3B30]"
                        : "bg-black/[0.04] text-[#6E6E73]"
                    }`}
                  >
                    {item.stock_quantity} {item.unit}
                  </span>
                </div>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="col-span-full py-16 text-center text-[#86868B]">
              <Boxes className="w-8 h-8 mx-auto text-[#86868B]/40 mb-2" />
              <p className="text-xs font-semibold text-[#1D1D1F]">No matching items found</p>
              <p className="text-[11px] text-[#86868B] mt-0.5">
                Press "+ Product" to add it to catalog and current sale
              </p>
            </div>
          )}
        </div>

        {/* Mobile Floating Cart Summary Pill */}
        {cart.length > 0 && mobileView === "catalog" && (
          <div className="lg:hidden fixed bottom-16 left-4 right-4 z-30">
            <button
              onClick={() => setMobileView("cart")}
              className="w-full py-3 px-4 rounded-2xl bg-[#1D1D1F] text-white shadow-xl flex items-center justify-between border border-white/10 apple-press"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">
                  {totalCartCount}
                </span>
                <span className="text-xs font-semibold">View Active Ticket</span>
              </div>
              <span className="text-sm font-bold font-mono text-[#34C759]">
                {formatCurrency(totalAmount)} →
              </span>
            </button>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Active Ticket & Checkout */}
      <div
        className={`w-full lg:w-[410px] bg-white flex flex-col h-full shrink-0 border-l border-black/[0.07] shadow-sm overflow-hidden ${
          mobileView === "catalog" ? "hidden lg:flex" : "flex"
        }`}
      >
        {/* Ticket Header & Customer Selector */}
        <div className="p-3.5 border-b border-black/[0.06] bg-white">
          {/* Bill Mode Tabs */}
          <div className="flex items-center p-0.5 bg-[#F5F5F7] rounded-xl border border-black/[0.06] mb-3">
            <button
              type="button"
              onClick={() => {
                setBillMode("SALE");
                setSelectedPartyId("");
                setCustomCustomerName("");
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition apple-press ${
                billMode === "SALE"
                  ? "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Sale
            </button>
            <button
              type="button"
              onClick={() => {
                setBillMode("QUOTATION");
                setSelectedPartyId("");
                setCustomCustomerName("");
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition apple-press ${
                billMode === "QUOTATION"
                  ? "bg-white text-[#FF9500] shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Quote
            </button>
            <button
              type="button"
              onClick={() => {
                setBillMode("PURCHASE");
                setSelectedPartyId("");
                setCustomCustomerName("");
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition apple-press ${
                billMode === "PURCHASE"
                  ? "bg-white text-[#34C759] shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Inward
            </button>
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#1D1D1F]">
              {billMode === "PURCHASE"
                ? "Inward Bill"
                : billMode === "QUOTATION"
                ? "Price Quotation"
                : "Active Ticket"}{" "}
              <span className="text-[#86868B] font-normal">({cart.length} items)</span>
            </span>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-[11px] text-[#FF3B30] hover:underline font-medium cursor-pointer"
              >
                Clear Ticket
              </button>
            )}
          </div>

          {/* Customer Dropdown with + Add Customer button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1" ref={customerMenuRef}>
              <button
                type="button"
                onClick={() => setIsCustomerMenuOpen(!isCustomerMenuOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#F5F5F7] border border-black/[0.06] text-xs font-medium text-[#1D1D1F] hover:bg-[#EBEBED] transition cursor-pointer select-none"
              >
                <span className="truncate">
                  {selectedPartyId
                    ? parties.find((p) => p.id === selectedPartyId)?.name
                    : customCustomerName ||
                      (billMode === "PURCHASE"
                        ? "Supplier Direct Inward"
                        : "Walk-in Customer")}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#86868B] shrink-0 ml-1.5 transition-transform duration-150 ${
                    isCustomerMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isCustomerMenuOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-black/[0.08] rounded-2xl shadow-xl z-30 max-h-48 overflow-y-auto p-1 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPartyId("");
                      setCustomCustomerName("");
                      setIsCustomerMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-[#F5F5F7] text-[#1D1D1F] font-semibold cursor-pointer"
                  >
                    {billMode === "PURCHASE" ? "Supplier Direct Inward" : "Walk-in Customer"}
                  </button>
                  {parties
                    .filter((p) =>
                      billMode === "PURCHASE" ? p.party_type === "VENDOR" : p.party_type === "CUSTOMER"
                    )
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPartyId(p.id);
                          setIsCustomerMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-[#F5F5F7] flex justify-between items-center cursor-pointer ${
                          selectedPartyId === p.id
                            ? "bg-black/5 text-black font-bold"
                            : "text-[#1D1D1F]"
                        }`}
                      >
                        <span className="truncate font-medium">{p.name}</span>
                        {p.current_balance !== 0 && (
                          <span className="text-[10px] font-mono text-[#86868B] ml-2 shrink-0">
                            {formatCurrency(Math.abs(p.current_balance))}
                          </span>
                        )}
                      </button>
                    ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAddCustomerModal(true)}
              className="h-8 px-2.5 rounded-xl bg-[#F5F5F7] hover:bg-[#EBEBED] text-[#1D1D1F] border border-black/[0.06] text-xs font-semibold flex items-center gap-1.5 transition apple-press shrink-0 cursor-pointer"
              title={billMode === "PURCHASE" ? "Add New Supplier" : "Add New Customer"}
            >
              <UserPlus className="w-3.5 h-3.5 text-black" />
              <span className="text-[11px] font-medium hidden sm:inline">
                {billMode === "PURCHASE" ? "+ Supplier" : "+ Customer"}
              </span>
              <span className="text-[11px] font-medium sm:hidden">+</span>
            </button>
          </div>
        </div>

        {/* Ticket Line Items */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
          {cart.map((item) => (
            <div
              key={item.item_id}
              className="p-3 rounded-2xl border border-black/[0.06] bg-[#FBFBFC] flex flex-col gap-2"
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-semibold text-[#1D1D1F] leading-snug">
                    {item.item_name}
                  </span>
                  <span className="text-[10px] text-[#86868B] font-mono">
                    {item.sku || "—"}
                  </span>
                </div>
                <button
                  onClick={() => removeFromCart(item.item_id)}
                  className="text-[#86868B] hover:text-[#FF3B30] transition p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateQuantity(item.item_id, -1)}
                    className="w-6 h-6 rounded-lg bg-white border border-black/[0.08] text-[#1D1D1F] hover:bg-[#F5F5F7] flex items-center justify-center transition apple-press"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center text-xs font-bold font-mono text-[#1D1D1F]">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.item_id, 1)}
                    className="w-6 h-6 rounded-lg bg-white border border-black/[0.08] text-[#1D1D1F] hover:bg-[#F5F5F7] flex items-center justify-center transition apple-press"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] text-[#86868B] ml-1">{item.unit}</span>
                </div>

                <div className="text-right">
                  {billMode === "PURCHASE" ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-[#86868B] font-mono">{currency}</span>
                      <input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateItemPrice(item.item_id, parseFloat(e.target.value) || 0)
                        }
                        className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold text-[#1D1D1F] bg-white border border-black/[0.08] rounded text-right focus:outline-none"
                      />
                    </div>
                  ) : (
                    <span className="text-xs font-bold font-mono text-[#1D1D1F]">
                      {formatCurrency(item.unit_price * item.quantity)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center text-[#86868B]">
              <div className="w-10 h-10 rounded-2xl bg-[#F5F5F7] text-[#86868B] flex items-center justify-center mb-2">
                <Barcode className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-[#1D1D1F]">Ticket is Empty</p>
              <p className="text-[11px] text-[#86868B] mt-0.5">
                Scan barcode or tap items in catalog
              </p>
            </div>
          )}
        </div>

        {/* Totals & Payment Control */}
        <div className="border-t border-black/[0.07] bg-white flex flex-col shrink-0 min-h-0">
          <div className="p-3.5 space-y-2.5 overflow-y-auto max-h-[46vh]">
          
          {/* Numbers breakdown */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-[#6E6E73]">
              <span>Subtotal</span>
              <span className="font-mono">
                {formatCurrency(displaySubtotal)}
              </span>
            </div>

            <div className="flex justify-between text-[#6E6E73]">
              <span>
                {settings.tax_name} ({settings.default_tax_rate}% {isTaxInclusive ? "Incl." : ""})
              </span>
              <span className="font-mono">
                {isTaxInclusive ? "" : "+"}{formatCurrency(taxAmount)}
              </span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-[#34C759] font-medium">
                <span>Discount</span>
                <span className="font-mono">
                  -{formatCurrency(discountAmount)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-1.5 border-t border-black/[0.06] text-sm font-bold text-[#1D1D1F]">
              <span>Grand Total</span>
              <span className="text-xl font-mono font-bold text-[#1D1D1F]">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {/* Payment Methods */}
          {billMode === "SALE" && (
            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap gap-1.5">
                {/* Cash */}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("CASH");
                    setIsSplitPayment(false);
                  }}
                  className={`flex-1 min-w-[70px] py-2 px-1.5 rounded-xl border text-xs flex flex-col items-center gap-1 transition apple-press cursor-pointer ${
                    paymentMethod === "CASH" && !isSplitPayment
                      ? "bg-[#1D1D1F] text-white border-[#1D1D1F] font-semibold shadow-xs"
                      : "bg-white text-[#6E6E73] hover:text-[#1D1D1F] border-black/[0.08] hover:bg-[#F5F5F7]"
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span className="text-[11px] truncate">Cash</span>
                </button>

                {/* Card */}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("CARD");
                    setIsSplitPayment(false);
                  }}
                  className={`flex-1 min-w-[70px] py-2 px-1.5 rounded-xl border text-xs flex flex-col items-center gap-1 transition apple-press cursor-pointer ${
                    paymentMethod === "CARD" && !isSplitPayment
                      ? "bg-[#1D1D1F] text-white border-[#1D1D1F] font-semibold shadow-xs"
                      : "bg-white text-[#6E6E73] hover:text-[#1D1D1F] border-black/[0.08] hover:bg-[#F5F5F7]"
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span className="text-[11px] truncate">Card</span>
                </button>

                {/* Custom Method 1 */}
                {settings.custom_payment_1_enabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod("CUSTOM_1");
                      setIsSplitPayment(false);
                    }}
                    className={`flex-1 min-w-[70px] py-2 px-1.5 rounded-xl border text-xs flex flex-col items-center gap-1 transition apple-press cursor-pointer ${
                      paymentMethod === "CUSTOM_1" && !isSplitPayment
                        ? "bg-[#1D1D1F] text-white border-[#1D1D1F] font-semibold shadow-xs"
                        : "bg-white text-[#6E6E73] hover:text-[#1D1D1F] border-black/[0.08] hover:bg-[#F5F5F7]"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span className="text-[11px] truncate">
                      {settings.custom_payment_1_name || "Custom 1"}
                    </span>
                  </button>
                )}

                {/* Custom Method 2 */}
                {settings.custom_payment_2_enabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod("CUSTOM_2");
                      setIsSplitPayment(false);
                    }}
                    className={`flex-1 min-w-[70px] py-2 px-1.5 rounded-xl border text-xs flex flex-col items-center gap-1 transition apple-press cursor-pointer ${
                      paymentMethod === "CUSTOM_2" && !isSplitPayment
                        ? "bg-[#1D1D1F] text-white border-[#1D1D1F] font-semibold shadow-xs"
                        : "bg-white text-[#6E6E73] hover:text-[#1D1D1F] border-black/[0.08] hover:bg-[#F5F5F7]"
                    }`}
                  >
                    <Building className="w-3.5 h-3.5" />
                    <span className="text-[10.5px] font-semibold truncate max-w-full px-0.5" title={settings.custom_payment_2_name || "Custom 2"}>
                      {settings.custom_payment_2_name || "Custom 2"}
                    </span>
                  </button>
                )}
              </div>

              {/* Cash Quick Tenders */}
              {paymentMethod === "CASH" && !isSplitPayment && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      placeholder="Tendered cash..."
                      value={tenderedAmount}
                      onChange={(e) => setTenderedAmount(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-mono font-semibold focus:outline-none focus:border-black"
                    />
                    <div className="flex gap-1 shrink-0">
                      {(currency === "₹" || currency.includes("₹")
                        ? [50, 100, 200, 500]
                        : [10, 20, 50, 100]
                      ).map((denom) => (
                        <button
                          key={denom}
                          type="button"
                          onClick={() => setTenderedAmount(denom.toString())}
                          className="px-2 py-1 rounded-lg bg-[#F5F5F7] hover:bg-[#EBEBED] text-[10px] font-mono font-semibold text-[#1D1D1F] transition apple-press cursor-pointer"
                        >
                          {currency}{denom}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setTenderedAmount(totalAmount.toFixed(2))}
                        className="px-2 py-1 rounded-lg bg-black/5 hover:bg-black/10 text-[10px] font-semibold text-black transition apple-press cursor-pointer border border-black/10"
                      >
                        Exact
                      </button>
                    </div>
                  </div>

                  {tenderedAmount && parseFloat(tenderedAmount) > 0 && (
                    <div className="flex justify-between items-center px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/50">
                      <span>Change Due:</span>
                      <span className="font-mono text-sm font-bold">
                        {currency}
                        {changeDue.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Reference Number for Card / Custom Methods */}
              {(paymentMethod === "CARD" || paymentMethod === "CUSTOM_1" || paymentMethod === "CUSTOM_2") && !isSplitPayment && (
                <input
                  type="text"
                  placeholder="Card auth code or transaction ref (optional)..."
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-medium focus:outline-none focus:border-black"
                />
              )}

              {/* Secondary Options: Split Tender, Credit & Receipt Preview */}
              <div className="flex items-center justify-between pt-1.5 gap-2 border-t border-black/[0.04]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSplitPayment(!isSplitPayment);
                      if (!isSplitPayment && paymentMethod === "CREDIT") {
                        setPaymentMethod("CASH");
                      }
                    }}
                    className={`text-[11px] font-medium transition cursor-pointer py-1 px-1.5 rounded-lg ${
                      isSplitPayment ? "text-white font-semibold bg-[#1D1D1F]" : "text-[#86868B] hover:text-[#1D1D1F]"
                    }`}
                  >
                    {isSplitPayment ? "✓ Split Tender" : "+ Split Tender"}
                  </button>

                  <span className="text-black/15">|</span>

                  {/* Credit Button beside Split Tender */}
                  <button
                    type="button"
                    onClick={() => {
                      if (paymentMethod === "CREDIT") {
                        setPaymentMethod("CASH");
                      } else {
                        setPaymentMethod("CREDIT");
                        setIsSplitPayment(false);
                        if (!selectedPartyId) {
                          const customers = parties.filter((p) => p.party_type === "CUSTOMER");
                          if (customers.length === 0) {
                            setShowAddCustomerModal(true);
                          }
                        }
                      }
                    }}
                    className={`py-1 px-2.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition apple-press cursor-pointer border ${
                      paymentMethod === "CREDIT" && !isSplitPayment
                        ? "bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-xs"
                        : "bg-neutral-100 text-neutral-800 border-neutral-300 hover:bg-neutral-200"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Credit</span>
                  </button>
                </div>

                <label className="flex items-center gap-1.5 text-[11px] text-[#86868B] hover:text-[#1D1D1F] cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={previewAfterSale}
                    onChange={(e) => handleTogglePreview(e.target.checked)}
                    className="rounded text-black accent-black focus:ring-0 cursor-pointer"
                  />
                  <span>Show receipt</span>
                </label>
              </div>

              {isSplitPayment && (
                <div className="p-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#6E6E73]">Cash:</span>
                    <input
                      type="number"
                      placeholder={`${currency} Cash`}
                      value={splitCash}
                      onChange={(e) => setSplitCash(e.target.value)}
                      className="w-24 px-2 py-1 rounded-lg border border-black/[0.08] bg-white text-right font-mono"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#6E6E73]">Card / Wallet:</span>
                    <input
                      type="number"
                      placeholder={`${currency} Card`}
                      value={splitCard}
                      onChange={(e) => setSplitCard(e.target.value)}
                      className="w-24 px-2 py-1 rounded-lg border border-black/[0.08] bg-white text-right font-mono"
                    />
                  </div>
                </div>
              )}

              {/* CREDIT BILLING PANEL */}
              {paymentMethod === "CREDIT" && !isSplitPayment && (
                <div className="p-3 rounded-2xl bg-[#FFF9F2] border border-[#FF9500]/25 space-y-2.5 animate-in fade-in duration-150">
                  {/* Customer status */}
                  {!selectedPartyId ? (
                    <div className="p-2.5 rounded-xl bg-amber-100/60 border border-amber-300/50 space-y-2">
                      <div className="flex items-start justify-between gap-2 text-xs text-amber-900">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">Customer Details Required</span>
                            <span className="text-[11px] text-amber-800">
                              Select an existing debtor or register a new customer with name & phone.
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAddCustomerModal(true)}
                          className="px-2.5 py-1 rounded-lg bg-black hover:bg-neutral-800 text-white text-[10px] font-bold transition shrink-0 cursor-pointer shadow-xs"
                        >
                          + New Customer
                        </button>
                      </div>

                      {/* Quick picker from existing customers */}
                      {parties.filter((p) => p.party_type === "CUSTOMER").length > 0 && (
                        <div className="pt-1">
                          <label className="text-[10px] font-semibold text-amber-900 block mb-1">
                            Choose debtor account:
                          </label>
                          <select
                            value={selectedPartyId}
                            onChange={(e) => {
                              setSelectedPartyId(e.target.value);
                              const found = parties.find((p) => p.id === e.target.value);
                              if (found) setCustomCustomerName(found.name);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-amber-300 text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:border-black"
                          >
                            <option value="">-- Select Customer for Credit Bill --</option>
                            {parties
                              .filter((p) => p.party_type === "CUSTOMER")
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} {p.phone ? `(${p.phone})` : ""} · Balance: {formatCurrency(p.current_balance)}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-xl bg-white border border-black/10">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-black" />
                        <span className="text-[#86868B] text-[11px]">Ledger Account:</span>
                        <span className="font-bold text-[#1D1D1F]">
                          {parties.find((p) => p.id === selectedPartyId)?.name}
                        </span>
                        {parties.find((p) => p.id === selectedPartyId)?.phone && (
                          <span className="text-[10px] text-[#86868B]">
                            ({parties.find((p) => p.id === selectedPartyId)?.phone})
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPartyId("")}
                        className="text-[10px] text-black font-bold hover:underline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {/* Mode Selector: 100% Credit vs Half/Partial */}
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/[0.04] rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setIsHalfCredit(false);
                        setCreditPaidAmount("0");
                      }}
                      className={`py-1.5 px-2 rounded-lg transition ${
                        !isHalfCredit
                          ? "bg-white text-[#FF9500] shadow-2xs font-bold"
                          : "text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      100% Full Credit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsHalfCredit(true);
                        setCreditPaidAmount((totalAmount / 2).toFixed(2));
                      }}
                      className={`py-1.5 px-2 rounded-lg transition ${
                        isHalfCredit
                          ? "bg-white text-[#FF9500] shadow-2xs font-bold"
                          : "text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      Half / Partial Paid
                    </button>
                  </div>

                  {/* If Half / Partial is Active */}
                  {isHalfCredit && (
                    <div className="space-y-2 pt-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Paid today..."
                          value={creditPaidAmount}
                          onChange={(e) => setCreditPaidAmount(e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white font-mono font-bold text-[#1D1D1F] focus:outline-none focus:border-[#FF9500]"
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setCreditPaidAmount((totalAmount / 2).toFixed(2))}
                            className="px-2 py-1 rounded-lg bg-[#FF9500]/10 hover:bg-[#FF9500]/20 text-[10px] font-bold text-[#FF9500] transition cursor-pointer"
                          >
                            50% (Half)
                          </button>
                          <button
                            type="button"
                            onClick={() => setCreditPaidAmount((totalAmount * 0.25).toFixed(2))}
                            className="px-2 py-1 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-[10px] font-semibold text-[#1D1D1F] transition cursor-pointer"
                          >
                            25%
                          </button>
                        </div>
                      </div>

                      {/* Paid portion method selector */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#86868B]">Paid portion method:</span>
                        <div className="flex gap-1 flex-wrap">
                          {[
                            "CASH",
                            "CARD",
                            ...(settings.custom_payment_1_enabled ? [settings.custom_payment_1_name || "Custom 1"] : []),
                            ...(settings.custom_payment_2_enabled ? [settings.custom_payment_2_name || "Custom 2"] : []),
                          ].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setCreditPaidMethod(m)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition ${
                                creditPaidMethod === m
                                  ? "bg-[#1D1D1F] text-white"
                                  : "bg-white text-[#6E6E73] border border-black/[0.08]"
                              }`}
                            >
                              {m === "CASH" ? "Cash" : m === "CARD" ? "Card" : m}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Financial breakdown */}
                      {(() => {
                        const paidNum = Math.min(totalAmount, Math.max(0, parseFloat(creditPaidAmount) || 0));
                        const remCredit = Math.max(0, totalAmount - paidNum);
                        return (
                          <div className="p-2 rounded-xl bg-white border border-[#FF9500]/20 text-[11px] flex justify-between items-center">
                            <span>
                              Paid: <strong className="font-mono text-emerald-600">{currency}{paidNum.toFixed(2)}</strong>
                            </span>
                            <span>
                              To Credit: <strong className="font-mono text-[#FF9500]">{currency}{remCredit.toFixed(2)}</strong>
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          </div>

          {/* Pinned Checkout Button */}
          <div className="p-3 pt-2 bg-white border-t border-black/[0.05] shrink-0">
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isSubmitting}
              className={`w-full py-3.5 rounded-full font-bold text-xs sm:text-sm text-white flex items-center justify-center gap-2 shadow-sm transition apple-press disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                licenseStatus?.is_expired
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-black hover:bg-neutral-800 text-white uppercase tracking-wider"
              }`}
            >
              {licenseStatus?.is_expired ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Trial Expired · Activate ({formatCurrency(totalAmount)})</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? "Processing..."
                      : billMode === "PURCHASE"
                      ? `Record Inward (${formatCurrency(totalAmount)})`
                      : billMode === "QUOTATION"
                      ? `Issue Quotation (${formatCurrency(totalAmount)})`
                      : `Charge ${formatCurrency(totalAmount)}`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* QUICK ADD PRODUCT MODAL */}
      {showQuickAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-black/[0.08] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-black lux-modal-card">
            <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#F9FAFB]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-black/5 text-black flex items-center justify-center border border-black/10">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-black tracking-tight">
                    New Product
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Add to catalog &amp; current ticket
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickAddModal(false)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Colombian Espresso 1kg"
                  value={quickProduct.name}
                  onChange={(e) => setQuickProduct({ ...quickProduct, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-white text-xs font-medium text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20 placeholder:text-neutral-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Sale Price ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={quickProduct.sale_price}
                    onChange={(e) => setQuickProduct({ ...quickProduct, sale_price: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-white text-xs font-mono font-medium text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20 placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Cost Price ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={quickProduct.purchase_price}
                    onChange={(e) => setQuickProduct({ ...quickProduct, purchase_price: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-white text-xs font-mono font-medium text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20 placeholder:text-neutral-400"
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
                    placeholder="e.g. Coffee Beans"
                    value={quickProduct.category}
                    onChange={(e) => setQuickProduct({ ...quickProduct, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-white text-xs font-medium text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20 placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Starting Stock
                  </label>
                  <input
                    type="number"
                    value={quickProduct.stock_quantity}
                    onChange={(e) => setQuickProduct({ ...quickProduct, stock_quantity: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-white text-xs font-mono font-medium text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20 placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="flex-1 py-2.5 rounded-full border border-black/10 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isQuickAdding}
                  className="flex-1 py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {isQuickAdding ? "Adding..." : "Add to Sale"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Customer / Vendor Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-black/[0.08] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 text-black lux-modal-card">
            <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#F9FAFB]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-black/5 text-black flex items-center justify-center border border-black/10">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-black tracking-tight">
                    {billMode === "PURCHASE" ? "Add Supplier" : "Add Customer"}
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Local database record
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-5 space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Rahul Sharma"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-white text-xs font-medium text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20 placeholder:text-neutral-400 transition"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Phone <span className="text-neutral-500 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/10 bg-white text-xs font-mono font-medium text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20 placeholder:text-neutral-400 transition"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Email <span className="text-neutral-500 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="name@domain.com"
                  value={newCustomerForm.email}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/10 bg-white text-xs font-medium text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20 placeholder:text-neutral-400 transition"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Address <span className="text-neutral-500 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Street, City, Postal code..."
                  value={newCustomerForm.address}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/10 bg-white text-xs font-medium text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20 placeholder:text-neutral-400 transition resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="flex-1 py-2.5 rounded-full border border-black/10 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="flex-1 py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingCustomer ? "Saving..." : "Save Party"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Document / Receipt Modal */}
      {completedInvoice && (
        <InvoiceDocModal
          invoiceDetail={completedInvoice}
          settings={settings}
          onClose={() => setCompletedInvoice(null)}
        />
      )}
    </div>
  );
};
