import { useState, useEffect, useRef, useCallback } from "react";
import { products } from "./products";

const TVA = 0.06;
const CASHBACK_RATE = 0.05; // 5% fidélité
const VRAC_PRICE_PER_100G = 1.50;

const CATEGORY_EMOJIS = {
  "Bonbons": "🍬", "Red bull": "🐂", "Fanta": "🧃", "Coca cola": "🥤",
  "Monster": "🟢", "Kinder": "🍫", "Snickers& kitkat": "🍫", "Chocolat": "🍫",
  "Sucrée": "🍭", "Salé": "🥨", "Cheetos": "🧀", "Boissons": "🥤",
  "Boissons chaudes": "☕", "Surgelé": "🧊", "Nouilles": "🍜",
  "Céréales": "🥣", "Lay's": "🥔", "Pate à tartiner": "🫙",
  "Pop corn": "🍿", "Discovery": "🎁", "Harry potter": "⚡",
  "Cuberdons": "🔴", "Calendrier de l'avent": "📅", "Peluche et mug": "🧸",
  "Petit déjeuner": "🥐", "Autres": "✨"
};

const CATEGORIES = ["TOUT", ...Object.keys(CATEGORY_EMOJIS)];

export default function App() {
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState("TOUT");
  const [search, setSearch] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [modal, setModal] = useState(null); // 'payment' | 'vrac' | 'loyalty' | 'receipt'
  const [loyaltyClient, setLoyaltyClient] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [qrInput, setQrInput] = useState("");
  const [vracGrams, setVracGrams] = useState("");
  const barcodeRef = useRef(null);
  const searchRef = useRef(null);

  const filteredProducts = products.filter(p => {
    const matchCat = activeCategory === "TOUT" || p.categorie === activeCategory;
    const matchSearch = search === "" || p.nom.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.prix * item.qty, 0);
  const tvaAmount = cartTotal * TVA / (1 + TVA);
  const loyaltyDiscount = loyaltyClient ? Math.min(loyaltyClient.cagnotte, cartTotal) : 0;
  const finalTotal = cartTotal - loyaltyDiscount;
  const cashbackEarned = finalTotal * CASHBACK_RATE;

  const addToCart = useCallback((product, customPrix = null) => {
    const prix = customPrix || product.prix;
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id && !product.vrac);
      if (existing && !product.vrac) {
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, prix, qty: 1, cartId: Date.now() }];
    });
  }, []);

  const removeFromCart = (cartId) => {
    setCart(prev => prev.filter(i => i.cartId !== cartId));
  };

  const updateQty = (cartId, delta) => {
    setCart(prev => prev.map(i => {
      if (i.cartId !== cartId) return i;
      const newQty = i.qty + delta;
      return newQty <= 0 ? null : { ...i, qty: newQty };
    }).filter(Boolean));
  };

  // Barcode scanner
  const handleBarcode = (e) => {
    if (e.key === "Enter" && barcodeInput.trim()) {
      const found = products.find(p => p.barcode === barcodeInput.trim());
      if (found) {
        if (found.vrac) { setModal('vrac'); }
        else { addToCart(found); }
        setBarcodeInput("");
      } else {
        setBarcodeInput("");
        alert("Produit non trouvé: " + barcodeInput);
      }
    }
  };

  const handleVracAdd = () => {
    const grams = parseFloat(vracGrams);
    if (!grams || grams <= 0) return;
    const prix = (grams / 100) * VRAC_PRICE_PER_100G;
    const vracProduct = products.find(p => p.vrac) || { id: 9999, nom: "Bonbons vrac", categorie: "Bonbons", vrac: true };
    addToCart({ ...vracProduct, nom: `Bonbons vrac (${grams}g)`, cartId: Date.now() }, prix);
    setVracGrams("");
    setModal(null);
  };

  const handleLoyaltyLookup = async () => {
    if (!qrInput.trim()) return;
    try {
      const res = await fetch(`https://swrpladhwaspibpoegwn.supabase.co/rest/v1/customers?qr_code=eq.${qrInput.trim()}&select=*`, {
        headers: {
          apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cnBsYWRod2FzcGlicG9lZ3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTA0NzIsImV4cCI6MjA1OTc4NjQ3Mn0.qFBHxEP2ueN4lRAhEWd1p5MpBhA8YiVGMDcXCiVE0oY",
          Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cnBsYWRod2FzcGlicG9lZ3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTA0NzIsImV4cCI6MjA1OTc4NjQ3Mn0.qFBHxEP2ueN4lRAhEWd1p5MpBhA8YiVGMDcXCiVE0oY"
        }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        setLoyaltyClient(data[0]);
        setModal(null);
        setQrInput("");
      } else {
        alert("Client non trouvé");
      }
    } catch (e) {
      alert("Erreur connexion fidélité");
    }
  };

  const handlePayment = async (method) => {
    setPaymentMethod(method);
    // Update loyalty in Supabase
    if (loyaltyClient) {
      const newCagnotte = loyaltyClient.cagnotte - loyaltyDiscount + cashbackEarned;
      await fetch(`https://swrpladhwaspibpoegwn.supabase.co/rest/v1/customers?id=eq.${loyaltyClient.id}`, {
        method: 'PATCH',
        headers: {
          apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cnBsYWRod2FzcGlicG9lZ3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTA0NzIsImV4cCI6MjA1OTc4NjQ3Mn0.qFBHxEP2ueN4lRAhEWd1p5MpBhA8YiVGMDcXCiVE0oY",
          Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cnBsYWRod2FzcGlicG9lZ3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTA0NzIsImV4cCI6MjA1OTc4NjQ3Mn0.qFBHxEP2ueN4lRAhEWd1p5MpBhA8YiVGMDcXCiVE0oY",
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({ cagnotte: Math.max(0, newCagnotte) })
      });
    }
    setReceiptData({ cart, cartTotal, tvaAmount, loyaltyDiscount, cashbackEarned, finalTotal, method, client: loyaltyClient, date: new Date() });
    setModal('receipt');
  };

  const handleNewSale = () => {
    setCart([]);
    setLoyaltyClient(null);
    setModal(null);
    setPaymentMethod(null);
    setReceiptData(null);
    setSearch("");
  };

  const printReceipt = () => window.print();

  return (
    <div style={styles.app}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.logo}>🍬 MUNCHY'S</div>
        <div style={styles.headerCenter}>
          <input
            ref={searchRef}
            style={styles.searchInput}
            placeholder="🔍 Rechercher un produit..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={styles.headerRight}>
          <input
            ref={barcodeRef}
            style={styles.barcodeInput}
            placeholder="📷 Code-barres..."
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            onKeyDown={handleBarcode}
          />
          <button style={styles.btnVrac} onClick={() => setModal('vrac')}>⚖️ Vrac</button>
          <button style={styles.btnFidelite} onClick={() => setModal('loyalty')}>💳 Fidélité</button>
        </div>
      </div>

      <div style={styles.main}>
        {/* LEFT: Categories + Products */}
        <div style={styles.left}>
          {/* Category tabs */}
          <div style={styles.categoryBar}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                style={{ ...styles.catBtn, ...(activeCategory === cat ? styles.catBtnActive : {}) }}
                onClick={() => setActiveCategory(cat)}
              >
                {cat === "TOUT" ? "🍭 TOUT" : `${CATEGORY_EMOJIS[cat] || "•"} ${cat}`}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div style={styles.productGrid}>
            {filteredProducts.map(p => (
              <button
                key={p.id}
                style={{ ...styles.productCard, ...(p.vrac ? styles.productCardVrac : {}) }}
                onClick={() => p.vrac ? setModal('vrac') : addToCart(p)}
              >
                <div style={styles.productEmoji}>{CATEGORY_EMOJIS[p.categorie] || "🍬"}</div>
                <div style={styles.productName}>{p.nom}</div>
                <div style={styles.productPrice}>
                  {p.vrac ? `${(p.prix).toFixed(2)}€/100g` : `${p.prix.toFixed(2)}€`}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT: Cart */}
        <div style={styles.right}>
          <div style={styles.cartHeader}>
            🛒 CAISSE
            {loyaltyClient && (
              <div style={styles.loyaltyBadge}>
                💳 {loyaltyClient.first_name} — {loyaltyClient.cagnotte?.toFixed(2)}€
              </div>
            )}
          </div>

          <div style={styles.cartItems}>
            {cart.length === 0 && (
              <div style={styles.emptyCart}>Aucun article</div>
            )}
            {cart.map(item => (
              <div key={item.cartId} style={styles.cartItem}>
                <div style={styles.cartItemName}>{item.nom}</div>
                <div style={styles.cartItemControls}>
                  {!item.vrac && (
                    <>
                      <button style={styles.qtyBtn} onClick={() => updateQty(item.cartId, -1)}>−</button>
                      <span style={styles.qtyNum}>{item.qty}</span>
                      <button style={styles.qtyBtn} onClick={() => updateQty(item.cartId, 1)}>+</button>
                    </>
                  )}
                  <span style={styles.cartItemPrice}>{(item.prix * item.qty).toFixed(2)}€</span>
                  <button style={styles.removeBtn} onClick={() => removeFromCart(item.cartId)}>✕</button>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.cartFooter}>
            {loyaltyDiscount > 0 && (
              <div style={styles.discountRow}>
                <span>🎁 Remise fidélité</span>
                <span>−{loyaltyDiscount.toFixed(2)}€</span>
              </div>
            )}
            <div style={styles.totalRow}>
              <span>TOTAL TTC</span>
              <span style={styles.totalAmount}>{finalTotal.toFixed(2)}€</span>
            </div>
            <div style={styles.tvaRow}>
              <span>dont TVA 6%</span>
              <span>{tvaAmount.toFixed(2)}€</span>
            </div>

            <div style={styles.paymentBtns}>
              <button
                style={{ ...styles.payBtn, ...styles.payCard }}
                onClick={() => cart.length > 0 && setModal('payment')}
                disabled={cart.length === 0}
              >
                💳 CARTE
              </button>
              <button
                style={{ ...styles.payBtn, ...styles.payCash }}
                onClick={() => cart.length > 0 && handlePayment('espèces')}
                disabled={cart.length === 0}
              >
                💵 ESPÈCES
              </button>
            </div>

            <button style={styles.clearBtn} onClick={handleNewSale}>
              🗑️ Vider
            </button>
          </div>
        </div>
      </div>

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
            <input
              style={styles.loyaltyInput}
              placeholder="QR code ou ID client..."
              value={qrInput}
              onChange={e => setQrInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLoyaltyLookup()}
              autoFocus
            />
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
            <div style={styles.payAmount}>{finalTotal.toFixed(2)}€</div>
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
          <div style={{ ...styles.modalBox, ...styles.receiptBox }}>
            <div id="receipt" style={styles.receipt}>
              <div style={styles.receiptHeader}>
                <div style={styles.receiptLogo}>🍬 MUNCHY'S CANDY</div>
                <div style={styles.receiptAddr}>Mouscron, Belgique</div>
                <div style={styles.receiptAddr}>TVA BE 0750.497.413</div>
                <div style={styles.receiptDate}>{receiptData.date.toLocaleString('fr-BE')}</div>
              </div>
              <div style={styles.receiptDivider}>{'─'.repeat(32)}</div>
              {receiptData.cart.map((item, i) => (
                <div key={i} style={styles.receiptLine}>
                  <span>{item.nom} x{item.qty}</span>
                  <span>{(item.prix * item.qty).toFixed(2)}€</span>
                </div>
              ))}
              <div style={styles.receiptDivider}>{'─'.repeat(32)}</div>
              <div style={styles.receiptLine}>
                <span>Sous-total</span>
                <span>{receiptData.cartTotal.toFixed(2)}€</span>
              </div>
              {receiptData.loyaltyDiscount > 0 && (
                <div style={{ ...styles.receiptLine, color: '#e91e8c' }}>
                  <span>🎁 Remise fidélité</span>
                  <span>−{receiptData.loyaltyDiscount.toFixed(2)}€</span>
                </div>
              )}
              <div style={{ ...styles.receiptLine, fontWeight: 'bold', fontSize: 18 }}>
                <span>TOTAL TTC</span>
                <span>{receiptData.finalTotal.toFixed(2)}€</span>
              </div>
              <div style={styles.receiptLine}>
                <span>dont TVA 6%</span>
                <span>{receiptData.tvaAmount.toFixed(2)}€</span>
              </div>
              <div style={styles.receiptLine}>
                <span>Paiement</span>
                <span>{receiptData.method === 'carte' ? '💳 Carte' : '💵 Espèces'}</span>
              </div>
              {receiptData.client && (
                <>
                  <div style={styles.receiptDivider}>{'─'.repeat(32)}</div>
                  <div style={{ ...styles.receiptLine, color: '#e91e8c' }}>
                    <span>💳 Cashback gagné</span>
                    <span>+{receiptData.cashbackEarned.toFixed(2)}€</span>
                  </div>
                  <div style={styles.receiptLine}>
                    <span>Client: {receiptData.client.first_name}</span>
                  </div>
                </>
              )}
              <div style={styles.receiptDivider}>{'─'.repeat(32)}</div>
              <div style={styles.receiptFooter}>Merci de votre visite ! 🍬</div>
            </div>
            <div style={styles.modalBtns}>
              <button style={styles.btnCancel} onClick={printReceipt}>🖨️ Imprimer</button>
              <button style={styles.btnConfirm} onClick={handleNewSale}>Nouvelle vente ✓</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Nunito', sans-serif; background: #0f0f1a; }
        @media print {
          body * { visibility: hidden; }
          #receipt, #receipt * { visibility: visible; }
          #receipt { position: fixed; left: 0; top: 0; background: white; color: black; padding: 20px; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  app: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f1a', color: '#fff', fontFamily: "'Nunito', sans-serif", overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'linear-gradient(135deg, #e91e8c, #ff6b35)', boxShadow: '0 4px 20px rgba(233,30,140,0.4)', flexShrink: 0 },
  logo: { fontSize: 22, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', letterSpacing: -0.5 },
  headerCenter: { flex: 1 },
  headerRight: { display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 },
  searchInput: { width: '100%', padding: '8px 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 15, fontFamily: "'Nunito', sans-serif", fontWeight: 600, outline: 'none', '::placeholder': { color: 'rgba(255,255,255,0.7)' } },
  barcodeInput: { width: 180, padding: '8px 12px', borderRadius: 10, border: 'none', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 14, fontFamily: "'Nunito', sans-serif", outline: 'none' },
  btnVrac: { padding: '8px 14px', borderRadius: 10, border: 'none', background: '#fff', color: '#e91e8c', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: "'Nunito', sans-serif", whiteSpace: 'nowrap' },
  btnFidelite: { padding: '8px 14px', borderRadius: 10, border: 'none', background: 'rgba(0,0,0,0.3)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'Nunito', sans-serif", whiteSpace: 'nowrap' },
  main: { display: 'flex', flex: 1, overflow: 'hidden' },
  left: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  categoryBar: { display: 'flex', gap: 6, padding: '10px 12px', overflowX: 'auto', flexShrink: 0, background: '#16162a', borderBottom: '1px solid rgba(255,255,255,0.08)', scrollbarWidth: 'none' },
  catBtn: { padding: '6px 12px', borderRadius: 20, border: '2px solid transparent', background: 'rgba(255,255,255,0.07)', color: '#aaa', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'Nunito', sans-serif", transition: 'all 0.15s' },
  catBtnActive: { background: 'linear-gradient(135deg, #e91e8c, #ff6b35)', color: '#fff', border: '2px solid transparent', boxShadow: '0 2px 12px rgba(233,30,140,0.4)' },
  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, padding: 12, overflowY: 'auto', flex: 1, alignContent: 'start' },
  productCard: { background: 'linear-gradient(145deg, #1e1e35, #252540)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 8px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', fontFamily: "'Nunito', sans-serif", display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' },
  productCardVrac: { background: 'linear-gradient(145deg, #2a1a35, #3a1550)', border: '1px solid rgba(233,30,140,0.3)' },
  productEmoji: { fontSize: 24 },
  productName: { fontSize: 11, fontWeight: 700, color: '#ddd', lineHeight: 1.2, maxHeight: 32, overflow: 'hidden' },
  productPrice: { fontSize: 14, fontWeight: 900, color: '#e91e8c', marginTop: 2 },
  right: { width: 320, background: '#16162a', borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column' },
  cartHeader: { padding: '14px 16px', fontWeight: 900, fontSize: 18, background: 'linear-gradient(135deg, #1e1e35, #252540)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 6 },
  loyaltyBadge: { fontSize: 12, fontWeight: 700, color: '#e91e8c', background: 'rgba(233,30,140,0.1)', borderRadius: 8, padding: '4px 10px' },
  cartItems: { flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 },
  emptyCart: { color: '#555', textAlign: 'center', padding: 30, fontSize: 14 },
  cartItem: { background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 },
  cartItemName: { fontSize: 12, fontWeight: 700, color: '#ddd' },
  cartItemControls: { display: 'flex', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(233,30,140,0.2)', color: '#e91e8c', fontWeight: 900, cursor: 'pointer', fontSize: 16, fontFamily: "'Nunito', sans-serif" },
  qtyNum: { fontSize: 14, fontWeight: 800, color: '#fff', minWidth: 20, textAlign: 'center' },
  cartItemPrice: { marginLeft: 'auto', fontSize: 14, fontWeight: 800, color: '#fff' },
  removeBtn: { width: 22, height: 22, borderRadius: 6, border: 'none', background: 'rgba(255,50,50,0.2)', color: '#ff5555', fontWeight: 700, cursor: 'pointer', fontSize: 11, fontFamily: "'Nunito', sans-serif" },
  cartFooter: { padding: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 },
  discountRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#e91e8c', fontWeight: 700 },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  totalAmount: { fontSize: 28, fontWeight: 900, color: '#fff' },
  tvaRow: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666' },
  paymentBtns: { display: 'flex', gap: 8 },
  payBtn: { flex: 1, padding: '14px 8px', borderRadius: 14, border: 'none', fontWeight: 900, fontSize: 15, cursor: 'pointer', fontFamily: "'Nunito', sans-serif", transition: 'all 0.15s' },
  payCard: { background: 'linear-gradient(135deg, #e91e8c, #c2185b)', color: '#fff', boxShadow: '0 4px 16px rgba(233,30,140,0.4)' },
  payCash: { background: 'linear-gradient(135deg, #4caf50, #388e3c)', color: '#fff', boxShadow: '0 4px 16px rgba(76,175,80,0.3)' },
  clearBtn: { padding: '8px', borderRadius: 10, border: '1px solid rgba(255,50,50,0.3)', background: 'transparent', color: '#ff5555', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Nunito', sans-serif" },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' },
  modalBox: { background: '#1e1e35', borderRadius: 20, padding: 30, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)' },
  receiptBox: { width: 360, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 22, fontWeight: 900, marginBottom: 6, textAlign: 'center' },
  modalSub: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  payAmount: { fontSize: 48, fontWeight: 900, color: '#e91e8c', textAlign: 'center', margin: '20px 0' },
  loyaltyInput: { width: '100%', padding: '12px 16px', borderRadius: 12, border: '2px solid rgba(233,30,140,0.3)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 16, fontFamily: "'Nunito', sans-serif", outline: 'none', marginBottom: 20 },
  numpad: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 },
  numpadBtn: { padding: '16px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 20, fontWeight: 800, cursor: 'pointer', fontFamily: "'Nunito', sans-serif", transition: 'all 0.1s' },
  vracDisplay: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(233,30,140,0.1)', borderRadius: 12, padding: '14px 20px', marginBottom: 20 },
  vracGrams: { fontSize: 28, fontWeight: 900, color: '#fff' },
  vracPrice: { fontSize: 24, fontWeight: 900, color: '#e91e8c' },
  modalBtns: { display: 'flex', gap: 10 },
  btnCancel: { flex: 1, padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#aaa', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: "'Nunito', sans-serif" },
  btnConfirm: { flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #e91e8c, #ff6b35)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: "'Nunito', sans-serif" },
  receipt: { fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6, color: '#ddd', padding: '10px 0', marginBottom: 20 },
  receiptHeader: { textAlign: 'center', marginBottom: 10 },
  receiptLogo: { fontSize: 18, fontWeight: 900, color: '#e91e8c' },
  receiptAddr: { fontSize: 11, color: '#888' },
  receiptDate: { fontSize: 11, color: '#888', marginTop: 4 },
  receiptDivider: { color: '#444', margin: '8px 0', overflow: 'hidden' },
  receiptLine: { display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' },
  receiptFooter: { textAlign: 'center', marginTop: 10, color: '#e91e8c', fontWeight: 700 },
};
