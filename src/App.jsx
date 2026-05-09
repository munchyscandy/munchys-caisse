import { useState, useEffect, useCallback } from "react";
import { products as BASE_PRODUCTS } from "./products";

const TVA = 0.06;
const CASHBACK_RATE = 0.05;
const VRAC_PRICE_PER_100G = 1.50;
const SUPABASE_URL = "https://swrpladhwaspibpoegwn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cnBsYWRod2FzcGlicG9lZ3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTA0NzIsImV4cCI6MjA1OTc4NjQ3Mn0.qFBHxEP2ueN4lRAhEWd1p5MpBhA8YiVGMDcXCiVE0oY";
const SB_HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

const CATEGORY_EMOJIS = {
  "Bonbons":"🍬","Red bull":"🐂","Fanta":"🧃","Coca cola":"🥤","Monster":"🟢",
  "Kinder":"🍫","Snickers& kitkat":"🍫","Chocolat":"🍫","Sucrée":"🍭","Salé":"🥨",
  "Cheetos":"🧀","Boissons":"🥤","Boissons chaudes":"☕","Surgelé":"🧊","Nouilles":"🍜",
  "Céréales":"🥣","Lay's":"🥔","Pate à tartiner":"🫙","Pop corn":"🍿","Discovery":"🎁",
  "Harry potter":"⚡","Cuberdons":"🔴","Calendrier de l'avent":"📅","Peluche et mug":"🧸",
  "Petit déjeuner":"🥐","Autres":"✨"
};
const ALL_CATEGORIES = Object.keys(CATEGORY_EMOJIS);
const CATEGORIES = ["TOUT", ...ALL_CATEGORIES];

const fmt = (n) => parseFloat(n).toFixed(2).replace('.', ',') + '€';

export default function App() {
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState("TOUT");
  const [search, setSearch] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [modal, setModal] = useState(null);
  const [loyaltyClient, setLoyaltyClient] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [qrInput, setQrInput] = useState("");
  const [vracGrams, setVracGrams] = useState("");
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [customProducts, setCustomProducts] = useState([]);
  const [settingsSearch, setSettingsSearch] = useState("");
  const [editProduct, setEditProduct] = useState(null); // produit en cours d'édition
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  // Charge les produits custom depuis Supabase au démarrage
  useEffect(() => {
    loadCustomProducts();
  }, []);

  const loadCustomProducts = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/products_custom?actif=eq.true&select=*&order=id`, { headers: SB_HEADERS });
      const data = await res.json();
      if (Array.isArray(data)) setCustomProducts(data);
    } catch (e) { console.error(e); }
  };

  // Fusionne les produits : les custom remplacent les base si même base_product_id
  const allProducts = (() => {
    const overriddenIds = new Set(customProducts.filter(p => p.base_product_id != null).map(p => p.base_product_id));
    const baseFiltered = BASE_PRODUCTS.filter(p => !overriddenIds.has(p.id));
    const customMapped = customProducts.map(p => ({
      id: `custom_${p.id}`,
      nom: p.nom,
      categorie: p.categorie || "Autres",
      prix: parseFloat(p.prix) || 0,
      vrac: p.vrac || false,
      barcode: p.barcode || "",
      photo_url: p.photo_url || "",
      custom_id: p.id,
      base_product_id: p.base_product_id
    }));
    return [...customMapped, ...baseFiltered];
  })();

  const filteredProducts = allProducts.filter(p => {
    const matchCat = activeCategory === "TOUT" || p.categorie === activeCategory;
    const matchSearch = search === "" || p.nom.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const cartTotal = cart.reduce((s, i) => s + i.prix * i.qty, 0);
  const tvaAmount = cartTotal * TVA / (1 + TVA);
  const loyaltyDiscount = loyaltyClient ? Math.min(loyaltyClient.cagnotte || 0, cartTotal) : 0;
  const finalTotal = cartTotal - loyaltyDiscount;
  const cashbackEarned = finalTotal * CASHBACK_RATE;

  const addToCart = useCallback((product, customPrix = null) => {
    const prix = customPrix !== null ? customPrix : product.prix;
    setCart(prev => {
      if (!product.vrac) {
        const existing = prev.find(i => i.id === product.id);
        if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, prix, qty: 1, cartId: Date.now() }];
    });
  }, []);

  const removeFromCart = (cartId) => setCart(prev => prev.filter(i => i.cartId !== cartId));
  const updateQty = (cartId, delta) => setCart(prev =>
    prev.map(i => i.cartId !== cartId ? i : i.qty + delta <= 0 ? null : { ...i, qty: i.qty + delta }).filter(Boolean)
  );

  const handleBarcode = (e) => {
    if (e.key === "Enter" && barcodeInput.trim()) {
      const found = allProducts.find(p => p.barcode === barcodeInput.trim());
      if (found) { found.vrac ? setModal('vrac') : addToCart(found); }
      else alert("Produit non trouvé: " + barcodeInput);
      setBarcodeInput("");
    }
  };

  const handleVracAdd = () => {
    const grams = parseFloat(vracGrams);
    if (!grams || grams <= 0) return;
    const prix = (grams / 100) * VRAC_PRICE_PER_100G;
    const vracProduct = allProducts.find(p => p.vrac) || { id: 9999, nom: "Bonbons vrac", categorie: "Bonbons", vrac: true };
    addToCart({ ...vracProduct, nom: `Bonbons vrac (${grams}g)`, cartId: Date.now() }, prix);
    setVracGrams(""); setModal(null);
  };

  const handleLoyaltyLookup = async () => {
    if (!qrInput.trim()) return;
    try {
      let res = await fetch(`${SUPABASE_URL}/rest/v1/customers?qr_code=eq.${encodeURIComponent(qrInput.trim())}&select=*`, { headers: SB_HEADERS });
      let data = await res.json();
      if (!data || data.length === 0) {
        res = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(qrInput.trim())}&select=*`, { headers: SB_HEADERS });
        data = await res.json();
      }
      if (data && data.length > 0) { setLoyaltyClient(data[0]); setModal(null); setQrInput(""); }
      else alert("Client non trouvé.");
    } catch (e) { alert("Erreur connexion: " + e.message); }
  };

  const handlePayment = async (method) => {
    if (loyaltyClient) {
      const newCagnotte = (loyaltyClient.cagnotte || 0) - loyaltyDiscount + cashbackEarned;
      await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${loyaltyClient.id}`, {
        method: 'PATCH', headers: { ...SB_HEADERS, Prefer: "return=minimal" },
        body: JSON.stringify({ cagnotte: Math.max(0, newCagnotte) })
      });
    }
    setReceiptData({ cart: [...cart], cartTotal, tvaAmount, loyaltyDiscount, cashbackEarned, finalTotal, method, client: loyaltyClient, date: new Date() });
    setModal('receipt');
  };

  const handleNewSale = () => {
    setCart([]); setLoyaltyClient(null); setModal(null); setReceiptData(null); setSearch("");
  };

  // ---- SETTINGS : sauvegarde produit ----
  const openEditProduct = (product, isNew = false) => {
    if (isNew) {
      setEditProduct({ nom: "", categorie: "Bonbons", prix: "", vrac: false, barcode: "", photo_url: "" });
      setIsNewProduct(true);
    } else {
      setEditProduct({
        nom: product.nom, categorie: product.categorie, prix: product.prix,
        vrac: product.vrac, barcode: product.barcode, photo_url: product.photo_url || "",
        base_product_id: product.base_product_id || (!String(product.id).startsWith('custom_') ? product.id : null),
        custom_id: product.custom_id || null
      });
      setIsNewProduct(false);
    }
  };

  const saveProduct = async () => {
    if (!editProduct.nom || !editProduct.prix) { alert("Nom et prix obligatoires"); return; }
    setSavingProduct(true);
    const payload = {
      nom: editProduct.nom, categorie: editProduct.categorie,
      prix: parseFloat(String(editProduct.prix).replace(',', '.')),
      vrac: editProduct.vrac, barcode: editProduct.barcode || null,
      photo_url: editProduct.photo_url || null, actif: true,
      base_product_id: editProduct.base_product_id || null
    };
    try {
      if (editProduct.custom_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/products_custom?id=eq.${editProduct.custom_id}`, {
          method: 'PATCH', headers: { ...SB_HEADERS, Prefer: "return=minimal" }, body: JSON.stringify(payload)
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/products_custom`, {
          method: 'POST', headers: { ...SB_HEADERS, Prefer: "return=minimal" }, body: JSON.stringify(payload)
        });
      }
      await loadCustomProducts();
      setEditProduct(null);
    } catch (e) { alert("Erreur: " + e.message); }
    setSavingProduct(false);
  };

  const deleteCustomProduct = async (customId) => {
    if (!window.confirm("Supprimer ce produit ?")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/products_custom?id=eq.${customId}`, {
      method: 'PATCH', headers: { ...SB_HEADERS, Prefer: "return=minimal" }, body: JSON.stringify({ actif: false })
    });
    await loadCustomProducts();
  };

  const settingsProducts = allProducts.filter(p =>
    settingsSearch === "" || p.nom.toLowerCase().includes(settingsSearch.toLowerCase())
  );

  return (
    <div style={styles.app}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.logo}>🍬 MUNCHY'S</div>
        <div style={styles.headerCenter}>
          <input style={styles.searchInput} placeholder="Rechercher un produit..."
            value={search} onChange={e => setSearch(e.target.value)}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" />
        </div>
        <div style={styles.headerRight}>
          <input style={styles.barcodeInput} placeholder="Code-barres..."
            value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} onKeyDown={handleBarcode} />
          <button style={styles.btnVrac} onClick={() => setModal('vrac')}>⚖️ Vrac</button>
          <button style={styles.btnFidelite} onClick={() => setModal('loyalty')}>💳 Fidélité</button>
          <button style={styles.btnSettings} onClick={() => setShowSettings(true)}>⚙️</button>
        </div>
      </div>

      <div style={styles.main}>
        {/* LEFT */}
        <div style={styles.left}>
          <div style={styles.categoryBar}>
            {CATEGORIES.map(cat => (
              <button key={cat} style={{ ...styles.catBtn, ...(activeCategory === cat ? styles.catBtnActive : {}) }}
                onClick={() => setActiveCategory(cat)}>
                {cat === "TOUT" ? "🍭 TOUT" : `${CATEGORY_EMOJIS[cat] || "•"} ${cat}`}
              </button>
            ))}
          </div>
          <div style={styles.productGrid}>
            {filteredProducts.map(p => (
              <button key={p.id} style={{ ...styles.productCard, ...(p.vrac ? styles.productCardVrac : {}) }}
                onClick={() => p.vrac ? setModal('vrac') : addToCart(p)}>
                {p.photo_url
                  ? <img src={p.photo_url} alt={p.nom} style={styles.productImg} onError={e => e.target.style.display='none'} />
                  : <div style={styles.productEmoji}>{CATEGORY_EMOJIS[p.categorie] || "🍬"}</div>
                }
                <div style={styles.productName}>{p.nom}</div>
                <div style={styles.productPrice}>{p.vrac ? `${p.prix.toFixed(2)}€/100g` : `${p.prix.toFixed(2)}€`}</div>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT: Cart */}
        <div style={styles.right}>
          <div style={styles.cartHeader}>
            🛒 CAISSE
            {loyaltyClient && <div style={styles.loyaltyBadge}>💳 {loyaltyClient.first_name} — {(loyaltyClient.cagnotte||0).toFixed(2)}€</div>}
          </div>
          <div style={styles.cartItems}>
            {cart.length === 0 && <div style={styles.emptyCart}>Aucun article</div>}
            {cart.map(item => (
              <div key={item.cartId} style={styles.cartItem}>
                <div style={styles.cartItemName}>{item.nom}</div>
                <div style={styles.cartItemControls}>
                  {!item.vrac && <>
                    <button style={styles.qtyBtn} onClick={() => updateQty(item.cartId, -1)}>−</button>
                    <span style={styles.qtyNum}>{item.qty}</span>
                    <button style={styles.qtyBtn} onClick={() => updateQty(item.cartId, 1)}>+</button>
                  </>}
                  <span style={styles.cartItemPrice}>{(item.prix * item.qty).toFixed(2)}€</span>
                  <button style={styles.removeBtn} onClick={() => removeFromCart(item.cartId)}>✕</button>
                </div>
              </div>
            ))}
          </div>
          <div style={styles.cartFooter}>
            {loyaltyDiscount > 0 && <div style={styles.discountRow}><span>🎁 Remise fidélité</span><span>−{fmt(loyaltyDiscount)}</span></div>}
            <div style={styles.totalRow}><span>TOTAL TTC</span><span style={styles.totalAmount}>{fmt(finalTotal)}</span></div>
            <div style={styles.tvaRow}><span>dont TVA 6%</span><span>{fmt(tvaAmount)}</span></div>
            <div style={styles.paymentBtns}>
              <button style={{ ...styles.payBtn, ...styles.payCard }} onClick={() => cart.length > 0 && setModal('payment')} disabled={cart.length === 0}>💳 CARTE</button>
              <button style={{ ...styles.payBtn, ...styles.payCash }} onClick={() => cart.length > 0 && handlePayment('espèces')} disabled={cart.length === 0}>💵 ESPÈCES</button>
            </div>
            <button style={styles.clearBtn} onClick={handleNewSale}>🗑️ Vider</button>
          </div>
        </div>
      </div>

      {/* ========== SETTINGS PANEL ========== */}
      {showSettings && (
        <div style={styles.settingsOverlay}>
          <div style={styles.settingsPanel}>
            <div style={styles.settingsHeader}>
              <span>⚙️ Gestion des produits</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={styles.btnAddProduct} onClick={() => openEditProduct(null, true)}>+ Nouveau produit</button>
                <button style={styles.settingsClose} onClick={() => setShowSettings(false)}>✕</button>
              </div>
            </div>
            <input style={styles.settingsSearch} placeholder="Rechercher un produit..."
              value={settingsSearch} onChange={e => setSettingsSearch(e.target.value)}
              autoComplete="off" />
            <div style={styles.settingsList}>
              {settingsProducts.slice(0, 200).map(p => (
                <div key={p.id} style={styles.settingsItem}>
                  {p.photo_url && <img src={p.photo_url} alt="" style={styles.settingsThumb} onError={e => e.target.style.display='none'} />}
                  {!p.photo_url && <div style={styles.settingsEmoji}>{CATEGORY_EMOJIS[p.categorie] || '🍬'}</div>}
                  <div style={styles.settingsItemInfo}>
                    <div style={styles.settingsItemName}>{p.nom}</div>
                    <div style={styles.settingsItemSub}>{p.categorie} · {p.vrac ? `${p.prix.toFixed(2)}€/100g` : `${p.prix.toFixed(2)}€`}
                      {p.barcode && ` · ${p.barcode}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button style={styles.editBtn} onClick={() => openEditProduct(p)}>✏️ Modifier</button>
                    {p.custom_id && <button style={styles.deleteBtn} onClick={() => deleteCustomProduct(p.custom_id)}>🗑️</button>}
                  </div>
                </div>
              ))}
              {settingsProducts.length === 0 && <div style={{ color: '#888', padding: 20, textAlign: 'center' }}>Aucun produit trouvé</div>}
              {settingsProducts.length > 200 && <div style={{ color: '#888', padding: 12, textAlign: 'center', fontSize: 12 }}>+ {settingsProducts.length - 200} autres résultats — affinez la recherche</div>}
            </div>
          </div>
        </div>
      )}

      {/* ========== EDIT PRODUCT MODAL ========== */}
      {editProduct && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modalBox, width: 480 }}>
            <h2 style={styles.modalTitle}>{isNewProduct ? '➕ Nouveau produit' : '✏️ Modifier le produit'}</h2>
            <div style={styles.editGrid}>
              <label style={styles.editLabel}>Nom *</label>
              <input style={styles.editInput} value={editProduct.nom} onChange={e => setEditProduct(p => ({ ...p, nom: e.target.value }))} />

              <label style={styles.editLabel}>Catégorie</label>
              <select style={styles.editInput} value={editProduct.categorie} onChange={e => setEditProduct(p => ({ ...p, categorie: e.target.value }))}>
                {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <label style={styles.editLabel}>Prix (€) *</label>
              <input style={styles.editInput} type="number" step="0.01" value={editProduct.prix}
                onChange={e => setEditProduct(p => ({ ...p, prix: e.target.value }))} />

              <label style={styles.editLabel}>Code-barres</label>
              <input style={styles.editInput} value={editProduct.barcode} onChange={e => setEditProduct(p => ({ ...p, barcode: e.target.value }))} />

              <label style={styles.editLabel}>Photo (URL)</label>
              <input style={styles.editInput} placeholder="https://..." value={editProduct.photo_url}
                onChange={e => setEditProduct(p => ({ ...p, photo_url: e.target.value }))} />

              <label style={styles.editLabel}>Vrac (poids)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" checked={editProduct.vrac} onChange={e => setEditProduct(p => ({ ...p, vrac: e.target.checked }))} />
                <span style={{ color: '#888', fontSize: 13 }}>Prix au 100g</span>
              </div>
            </div>
            {editProduct.photo_url && (
              <div style={{ textAlign: 'center', margin: '10px 0' }}>
                <img src={editProduct.photo_url} alt="" style={{ maxHeight: 80, borderRadius: 8 }} onError={e => e.target.style.display='none'} />
              </div>
            )}
            <div style={styles.modalBtns}>
              <button style={styles.btnCancel} onClick={() => setEditProduct(null)}>Annuler</button>
              <button style={styles.btnConfirm} onClick={saveProduct} disabled={savingProduct}>
                {savingProduct ? 'Sauvegarde...' : '💾 Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VRAC */}
      {modal === 'vrac' && (
        <div style={styles.overlay}>
          <div style={styles.modalBox}>
            <h2 style={styles.modalTitle}>⚖️ Bonbons en vrac</h2>
            <p style={styles.modalSub}>1,50€ / 100g</p>
            <div style={styles.numpad}>
              {['1','2','3','4','5','6','7','8','9','0','00','⌫'].map(k => (
                <button key={k} style={styles.numpadBtn} onClick={() => {
                  if (k === '⌫') setVracGrams(v => v.slice(0,-1));
                  else setVracGrams(v => v + k);
                }}>{k}</button>
              ))}
            </div>
            <div style={styles.vracDisplay}>
              <span style={styles.vracGrams}>{vracGrams || '0'} g</span>
              <span style={styles.vracPrice}>= {((parseFloat(vracGrams)||0)/100*VRAC_PRICE_PER_100G).toFixed(2)}€</span>
            </div>
            <div style={styles.modalBtns}>
              <button style={styles.btnCancel} onClick={() => { setModal(null); setVracGrams(""); }}>Annuler</button>
              <button style={styles.btnConfirm} onClick={handleVracAdd}>Ajouter ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LOYALTY */}
      {modal === 'loyalty' && (
        <div style={styles.overlay}>
          <div style={styles.modalBox}>
            <h2 style={styles.modalTitle}>💳 Scanner fidélité</h2>
            <p style={styles.modalSub}>Scannez le QR code client</p>
            <input style={styles.loyaltyInput} placeholder="QR code client..." value={qrInput}
              onChange={e => setQrInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLoyaltyLookup()} autoFocus />
            <div style={styles.modalBtns}>
              <button style={styles.btnCancel} onClick={() => { setModal(null); setQrInput(""); }}>Annuler</button>
              <button style={styles.btnConfirm} onClick={handleLoyaltyLookup}>Valider ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PAYMENT CARD */}
      {modal === 'payment' && (
        <div style={styles.overlay}>
          <div style={styles.modalBox}>
            <h2 style={styles.modalTitle}>💳 Paiement carte</h2>
            <div style={styles.payAmount}>{fmt(finalTotal)}</div>
            <p style={styles.modalSub}>Présentez le terminal myPOS Go 2 au client</p>
            <div style={styles.modalBtns}>
              <button style={styles.btnCancel} onClick={() => setModal(null)}>Annuler</button>
              <button style={styles.btnConfirm} onClick={() => handlePayment('carte')}>Paiement reçu ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECEIPT */}
      {modal === 'receipt' && receiptData && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modalBox, width: 360, maxHeight: '90vh', overflowY: 'auto' }}>
            <div id="receipt" style={styles.receipt}>
              <div style={styles.receiptHeader}>
                <div style={styles.receiptLogo}>🍬 MUNCHY'S CANDY</div>
                <div style={styles.receiptAddr}>Mouscron, Belgique</div>
                <div style={styles.receiptAddr}>TVA BE 0750.497.413</div>
                <div style={styles.receiptAddr}>{receiptData.date.toLocaleString('fr-BE')}</div>
              </div>
              <div style={styles.receiptDivider}>{'─'.repeat(32)}</div>
              {receiptData.cart.map((item, i) => (
                <div key={i} style={styles.receiptLine}>
                  <span>{item.nom} x{item.qty}</span><span>{(item.prix * item.qty).toFixed(2)}€</span>
                </div>
              ))}
              <div style={styles.receiptDivider}>{'─'.repeat(32)}</div>
              <div style={styles.receiptLine}><span>Sous-total</span><span>{receiptData.cartTotal.toFixed(2)}€</span></div>
              {receiptData.loyaltyDiscount > 0 && (
                <div style={{ ...styles.receiptLine, color: '#e91e8c' }}>
                  <span>🎁 Remise fidélité</span><span>−{receiptData.loyaltyDiscount.toFixed(2)}€</span>
                </div>
              )}
              <div style={{ ...styles.receiptLine, fontWeight: 'bold', fontSize: 16 }}>
                <span>TOTAL TTC</span><span>{receiptData.finalTotal.toFixed(2)}€</span>
              </div>
              <div style={{ ...styles.receiptLine, fontSize: 11, color: '#888' }}>
                <span>dont TVA 6%</span><span>{receiptData.tvaAmount.toFixed(2)}€</span>
              </div>
              <div style={styles.receiptLine}><span>Paiement</span><span>{receiptData.method === 'carte' ? '💳 Carte' : '💵 Espèces'}</span></div>
              {receiptData.client && <>
                <div style={styles.receiptDivider}>{'─'.repeat(32)}</div>
                <div style={{ ...styles.receiptLine, color: '#e91e8c' }}>
                  <span>💳 Cashback +5%</span><span>+{receiptData.cashbackEarned.toFixed(2)}€</span>
                </div>
              </>}
              <div style={styles.receiptDivider}>{'─'.repeat(32)}</div>
              <div style={styles.receiptFooter}>Merci de votre visite ! 🍬</div>
            </div>
            <div style={styles.modalBtns}>
              <button style={styles.btnCancel} onClick={() => window.print()}>🖨️ Imprimer</button>
              <button style={styles.btnConfirm} onClick={handleNewSale}>Nouvelle vente ✓</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Nunito', sans-serif; background: #0f0f1a; }
        button:disabled { opacity: 0.5; }
        @media print {
          body * { visibility: hidden; }
          #receipt, #receipt * { visibility: visible; }
          #receipt { position: fixed; left: 0; top: 0; background: white; color: black; padding: 20px; font-family: monospace; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  app: { display:'flex', flexDirection:'column', height:'100vh', background:'#0f0f1a', color:'#fff', fontFamily:"'Nunito',sans-serif", overflow:'hidden' },
  header: { display:'flex', alignItems:'center', gap:10, padding:'8px 14px', background:'linear-gradient(135deg,#e91e8c,#ff6b35)', boxShadow:'0 4px 20px rgba(233,30,140,0.4)', flexShrink:0 },
  logo: { fontSize:20, fontWeight:900, color:'#fff', whiteSpace:'nowrap' },
  headerCenter: { flex:1 },
  headerRight: { display:'flex', gap:8, alignItems:'center', flexShrink:0 },
  searchInput: { width:'100%', padding:'8px 14px', borderRadius:10, border:'none', background:'rgba(255,255,255,0.2)', color:'#fff', fontSize:14, fontFamily:"'Nunito',sans-serif", fontWeight:600, outline:'none' },
  barcodeInput: { width:160, padding:'7px 12px', borderRadius:10, border:'none', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:13, fontFamily:"'Nunito',sans-serif", outline:'none' },
  btnVrac: { padding:'7px 12px', borderRadius:10, border:'none', background:'#fff', color:'#e91e8c', fontWeight:800, fontSize:13, cursor:'pointer', fontFamily:"'Nunito',sans-serif", whiteSpace:'nowrap' },
  btnFidelite: { padding:'7px 12px', borderRadius:10, border:'none', background:'rgba(0,0,0,0.3)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:"'Nunito',sans-serif", whiteSpace:'nowrap' },
  btnSettings: { padding:'7px 12px', borderRadius:10, border:'none', background:'rgba(255,255,255,0.15)', color:'#fff', fontWeight:700, fontSize:18, cursor:'pointer', fontFamily:"'Nunito',sans-serif" },
  main: { display:'flex', flex:1, overflow:'hidden' },
  left: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
  categoryBar: { display:'flex', gap:5, padding:'8px 10px', overflowX:'auto', flexShrink:0, background:'#16162a', borderBottom:'1px solid rgba(255,255,255,0.08)', scrollbarWidth:'none' },
  catBtn: { padding:'5px 10px', borderRadius:20, border:'2px solid transparent', background:'rgba(255,255,255,0.07)', color:'#aaa', fontWeight:700, fontSize:11, cursor:'pointer', whiteSpace:'nowrap', fontFamily:"'Nunito',sans-serif" },
  catBtnActive: { background:'linear-gradient(135deg,#e91e8c,#ff6b35)', color:'#fff', boxShadow:'0 2px 12px rgba(233,30,140,0.4)' },
  productGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:7, padding:10, overflowY:'auto', flex:1, alignContent:'start' },
  productCard: { background:'linear-gradient(145deg,#1e1e35,#252540)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'10px 7px', cursor:'pointer', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:3 },
  productCardVrac: { background:'linear-gradient(145deg,#2a1a35,#3a1550)', border:'1px solid rgba(233,30,140,0.3)' },
  productEmoji: { fontSize:22 },
  productImg: { width:50, height:50, objectFit:'cover', borderRadius:8, marginBottom:2 },
  productName: { fontSize:10, fontWeight:700, color:'#ddd', lineHeight:1.2, maxHeight:28, overflow:'hidden' },
  productPrice: { fontSize:13, fontWeight:900, color:'#e91e8c', marginTop:2 },
  right: { width:300, background:'#16162a', borderLeft:'1px solid rgba(255,255,255,0.08)', display:'flex', flexDirection:'column' },
  cartHeader: { padding:'12px 14px', fontWeight:900, fontSize:16, background:'linear-gradient(135deg,#1e1e35,#252540)', borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0 },
  loyaltyBadge: { fontSize:11, fontWeight:700, color:'#e91e8c', background:'rgba(233,30,140,0.1)', borderRadius:6, padding:'3px 8px', marginTop:5, display:'inline-block' },
  cartItems: { flex:1, overflowY:'auto', padding:'7px 10px', display:'flex', flexDirection:'column', gap:5 },
  emptyCart: { color:'#555', textAlign:'center', padding:25, fontSize:13 },
  cartItem: { background:'rgba(255,255,255,0.04)', borderRadius:9, padding:'7px 9px', display:'flex', flexDirection:'column', gap:3 },
  cartItemName: { fontSize:11, fontWeight:700, color:'#ddd' },
  cartItemControls: { display:'flex', alignItems:'center', gap:5 },
  qtyBtn: { width:24, height:24, borderRadius:7, border:'none', background:'rgba(233,30,140,0.2)', color:'#e91e8c', fontWeight:900, cursor:'pointer', fontSize:15 },
  qtyNum: { fontSize:13, fontWeight:800, minWidth:18, textAlign:'center' },
  cartItemPrice: { marginLeft:'auto', fontSize:13, fontWeight:800 },
  removeBtn: { width:20, height:20, borderRadius:5, border:'none', background:'rgba(255,50,50,0.2)', color:'#ff5555', fontWeight:700, cursor:'pointer', fontSize:10 },
  cartFooter: { padding:12, borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', flexDirection:'column', gap:7, flexShrink:0 },
  discountRow: { display:'flex', justifyContent:'space-between', fontSize:12, color:'#e91e8c', fontWeight:700 },
  totalRow: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  totalAmount: { fontSize:26, fontWeight:900 },
  tvaRow: { display:'flex', justifyContent:'space-between', fontSize:10, color:'#666' },
  paymentBtns: { display:'flex', gap:7 },
  payBtn: { flex:1, padding:'12px 6px', borderRadius:12, border:'none', fontWeight:900, fontSize:14, cursor:'pointer', fontFamily:"'Nunito',sans-serif" },
  payCard: { background:'linear-gradient(135deg,#e91e8c,#c2185b)', color:'#fff', boxShadow:'0 4px 16px rgba(233,30,140,0.4)' },
  payCash: { background:'linear-gradient(135deg,#4caf50,#388e3c)', color:'#fff' },
  clearBtn: { padding:7, borderRadius:8, border:'1px solid rgba(255,50,50,0.3)', background:'transparent', color:'#ff5555', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:"'Nunito',sans-serif" },
  // Settings
  settingsOverlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:200, display:'flex', alignItems:'stretch' },
  settingsPanel: { width:'100%', maxWidth:700, margin:'auto', background:'#1a1a2e', display:'flex', flexDirection:'column', height:'90vh', borderRadius:16, overflow:'hidden', border:'1px solid rgba(255,255,255,0.1)' },
  settingsHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', background:'linear-gradient(135deg,#e91e8c,#ff6b35)', fontWeight:900, fontSize:18 },
  settingsClose: { padding:'6px 14px', borderRadius:8, border:'none', background:'rgba(0,0,0,0.3)', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:16 },
  btnAddProduct: { padding:'7px 16px', borderRadius:8, border:'none', background:'#fff', color:'#e91e8c', fontWeight:800, cursor:'pointer', fontSize:14 },
  settingsSearch: { margin:'12px 16px', padding:'10px 16px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:14, fontFamily:"'Nunito',sans-serif", outline:'none' },
  settingsList: { flex:1, overflowY:'auto', padding:'0 10px 10px' },
  settingsItem: { display:'flex', alignItems:'center', gap:12, padding:'10px 10px', borderRadius:10, marginBottom:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' },
  settingsThumb: { width:40, height:40, objectFit:'cover', borderRadius:8, flexShrink:0 },
  settingsEmoji: { fontSize:24, flexShrink:0, width:40, textAlign:'center' },
  settingsItemInfo: { flex:1, overflow:'hidden' },
  settingsItemName: { fontSize:13, fontWeight:700, color:'#ddd', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  settingsItemSub: { fontSize:11, color:'#888', marginTop:2 },
  editBtn: { padding:'5px 10px', borderRadius:7, border:'none', background:'rgba(233,30,140,0.2)', color:'#e91e8c', fontWeight:700, cursor:'pointer', fontSize:12, whiteSpace:'nowrap' },
  deleteBtn: { padding:'5px 8px', borderRadius:7, border:'none', background:'rgba(255,50,50,0.2)', color:'#ff5555', fontWeight:700, cursor:'pointer', fontSize:12 },
  // Edit modal
  editGrid: { display:'grid', gridTemplateColumns:'100px 1fr', gap:'10px 14px', marginBottom:16, alignItems:'center' },
  editLabel: { fontSize:13, color:'#aaa', fontWeight:700, textAlign:'right' },
  editInput: { padding:'8px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.07)', color:'#fff', fontSize:14, fontFamily:"'Nunito',sans-serif", outline:'none', width:'100%' },
  // Modals
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, backdropFilter:'blur(4px)' },
  modalBox: { background:'#1e1e35', borderRadius:18, padding:25, width:420, maxWidth:'95vw', boxShadow:'0 20px 60px rgba(0,0,0,0.8)', border:'1px solid rgba(255,255,255,0.1)' },
  modalTitle: { fontSize:20, fontWeight:900, marginBottom:5, textAlign:'center' },
  modalSub: { color:'#888', fontSize:13, textAlign:'center', marginBottom:18 },
  payAmount: { fontSize:44, fontWeight:900, color:'#e91e8c', textAlign:'center', margin:'18px 0' },
  loyaltyInput: { width:'100%', padding:'11px 14px', borderRadius:10, border:'2px solid rgba(233,30,140,0.3)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:15, fontFamily:"'Nunito',sans-serif", outline:'none', marginBottom:18 },
  numpad: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:14 },
  numpadBtn: { padding:14, borderRadius:10, border:'none', background:'rgba(255,255,255,0.08)', color:'#fff', fontSize:18, fontWeight:800, cursor:'pointer', fontFamily:"'Nunito',sans-serif" },
  vracDisplay: { display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(233,30,140,0.1)', borderRadius:10, padding:'12px 16px', marginBottom:16 },
  vracGrams: { fontSize:24, fontWeight:900 },
  vracPrice: { fontSize:20, fontWeight:900, color:'#e91e8c' },
  modalBtns: { display:'flex', gap:8 },
  btnCancel: { flex:1, padding:11, borderRadius:10, border:'1px solid rgba(255,255,255,0.2)', background:'transparent', color:'#aaa', fontWeight:700, cursor:'pointer', fontFamily:"'Nunito',sans-serif" },
  btnConfirm: { flex:1, padding:11, borderRadius:10, border:'none', background:'linear-gradient(135deg,#e91e8c,#ff6b35)', color:'#fff', fontWeight:800, cursor:'pointer', fontFamily:"'Nunito',sans-serif" },
  receipt: { fontFamily:'monospace', fontSize:12, lineHeight:1.6, color:'#ddd', padding:'8px 0', marginBottom:16 },
  receiptHeader: { textAlign:'center', marginBottom:8 },
  receiptLogo: { fontSize:16, fontWeight:900, color:'#e91e8c' },
  receiptAddr: { fontSize:10, color:'#888' },
  receiptDivider: { color:'#444', margin:'6px 0', overflow:'hidden' },
  receiptLine: { display:'flex', justifyContent:'space-between', fontSize:12, padding:'1px 0' },
  receiptFooter: { textAlign:'center', marginTop:8, color:'#e91e8c', fontWeight:700 },
};
