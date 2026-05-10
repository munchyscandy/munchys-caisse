import { useState, useEffect, useCallback, useRef } from "react";
import { products as BASE_PRODUCTS } from "./products";

const TVA = 0.06;
const CASHBACK_RATE = 0.05;
const VRAC_PRICE_PER_100G = 1.50;
const SUPABASE_URL = "https://swrpladhwaspibpoegwn.supabase.co";
const SUPABASE_KEY = "sb_publishable_1m5yOZvVzFfXQQYqoN8h_A_nd56vaPI";
const SB = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

const EMO = {
  "Bonbons":"🍬","Red bull":"🐂","Fanta":"🧃","Coca cola":"🥤","Monster":"🟢",
  "Kinder":"🍫","Snickers& kitkat":"🍫","Chocolat":"🍫","Sucrée":"🍭","Salé":"🥨",
  "Cheetos":"🧀","Boissons":"🥤","Boissons chaudes":"☕","Surgelé":"🧊","Nouilles":"🍜",
  "Céréales":"🥣","Lay's":"🥔","Pate à tartiner":"🫙","Pop corn":"🍿","Discovery":"🎁",
  "Harry potter":"⚡","Cuberdons":"🔴","Calendrier de l'avent":"📅","Peluche et mug":"🧸",
  "Petit déjeuner":"🥐","Autres":"✨"
};
const ALL_CATS = Object.keys(EMO);
const CATS = ["TOUT", ...ALL_CATS];
const fmt = (n) => parseFloat(n||0).toFixed(2).replace('.', ',') + '€';
const today = () => new Date().toISOString().split('T')[0];

export default function App() {
  // Cart
  const [cart, setCart] = useState([]);
  const [activeCat, setActiveCat] = useState("TOUT");
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [modal, setModal] = useState(null);
  // Loyalty
  const [client, setClient] = useState(null);
  const [useCagnotte, setUseCagnotte] = useState(false);
  const [allClients, setAllClients] = useState([]);
  const [loySearch, setLoySearch] = useState("");
  const [loyResults, setLoyResults] = useState([]);
  // Discount
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('percent');
  const [discountInput, setDiscountInput] = useState('');
  // Receipt
  const [receipt, setReceipt] = useState(null);
  // Vrac
  const [vracG, setVracG] = useState('');
  // Email
  const [emailClient, setEmailClient] = useState(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('produits');
  const [customProducts, setCustomProducts] = useState([]);
  const [settingsSearch, setSettingsSearch] = useState('');
  const [editProduct, setEditProduct] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const videoRef = { current: null };
  // Box Mystère
  const [boxes, setBoxes] = useState([]);
  const [editBox, setEditBox] = useState(null);
  const [boxSearch, setBoxSearch] = useState('');
  const [boxCartItems, setBoxCartItems] = useState([]);
  // Stock
  const [stockData, setStockData] = useState([]);
  const [editingStock, setEditingStock] = useState(null);
  const [stockSearch, setStockSearch] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [stockAlert, setStockAlert] = useState('5');
  const [boxQuantite, setBoxQuantite] = useState(1);

  useEffect(() => { loadCustomProducts(); loadClients(); loadBoxes(); }, []);

  const loadCustomProducts = async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/products_custom?select=*&order=id`, { headers: SB });
      const d = await r.json();
      if (Array.isArray(d)) setCustomProducts(d);
    } catch(e) {}
  };

  const loadClients = async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=*&order=name`, { headers: SB });
      const d = await r.json();
      if (Array.isArray(d)) setAllClients(d);
    } catch(e) {}
  };

  const loadBoxes = async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/box_contents?select=*&order=created_at.desc`, { headers: SB });
      const d = await r.json();
      if (Array.isArray(d)) setBoxes(d);
    } catch(e) {}
  };

  const loadStock = async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/stock?select=*&order=product_nom`, { headers: SB });
      const d = await r.json();
      if (Array.isArray(d)) setStockData(d);
    } catch(e) {}
  };

  const upsertStock = async (nom, qty, seuil) => {
    // Check if exists
    const r = await fetch(`${SUPABASE_URL}/rest/v1/stock?product_nom=eq.${encodeURIComponent(nom)}&select=id`, { headers: SB });
    const d = await r.json();
    if (d && d.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/stock?id=eq.${d[0].id}`, {
        method: 'PATCH', headers: {...SB, Prefer:"return=minimal"},
        body: JSON.stringify({quantite: qty, seuil_alerte: seuil, updated_at: new Date().toISOString()})
      });
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/stock`, {
        method: 'POST', headers: {...SB, Prefer:"return=minimal"},
        body: JSON.stringify({product_nom: nom, quantite: qty, seuil_alerte: seuil})
      });
    }
    loadStock();
  };

  const deductStock = async (produits, qty_boxes) => {
    for (const p of produits) {
      const total = p.qty * qty_boxes;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/stock?product_nom=eq.${encodeURIComponent(p.nom)}&select=id,quantite`, { headers: SB });
      const d = await r.json();
      if (d && d.length > 0) {
        const newQty = Math.max(0, (d[0].quantite||0) - total);
        await fetch(`${SUPABASE_URL}/rest/v1/stock?id=eq.${d[0].id}`, {
          method: 'PATCH', headers: {...SB, Prefer:"return=minimal"},
          body: JSON.stringify({quantite: newQty, updated_at: new Date().toISOString()})
        });
      }
    }
  };

  const addStock = async (nom, qty_add) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/stock?product_nom=eq.${encodeURIComponent(nom)}&select=id,quantite`, { headers: SB });
    const d = await r.json();
    if (d && d.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/stock?id=eq.${d[0].id}`, {
        method: 'PATCH', headers: {...SB, Prefer:"return=minimal"},
        body: JSON.stringify({quantite: (d[0].quantite||0) + qty_add, updated_at: new Date().toISOString()})
      });
      loadStock();
    }
  };

  // Products merge
  const allProducts = (() => {
    // Products hidden (actif=false with base_product_id) -> filter from base list
    const hidden = new Set(customProducts.filter(p => !p.actif && p.base_product_id != null).map(p => p.base_product_id));
    // Active custom products that override base products
    const overridden = new Set(customProducts.filter(p => p.actif && p.base_product_id != null).map(p => p.base_product_id));
    // Base products minus hidden and overridden
    const base = BASE_PRODUCTS.filter(p => !overridden.has(p.id) && !hidden.has(p.id));
    // Only active custom products shown
    const custom = customProducts.filter(p => p.actif).map(p => ({
      id: `c_${p.id}`, nom: p.nom, categorie: p.categorie||"Autres",
      prix: parseFloat(p.prix)||0, vrac: p.vrac||false,
      barcode: p.barcode||"", photo_url: p.photo_url||"",
      custom_id: p.id, base_product_id: p.base_product_id
    }));
    return [...custom, ...base];
  })();

  const filtered = allProducts.filter(p => {
    const cat = activeCat === "TOUT" || p.categorie === activeCat;
    const s = !search || p.nom.toLowerCase().includes(search.toLowerCase());
    return cat && s;
  });

  // Cart calculations
  const cartTotal = cart.reduce((s, i) => s + i.prix * i.qty, 0);
  const cagnotte = client ? (client.cagnotte||0) : 0;
  const cagnotteUsed = (client && useCagnotte) ? Math.min(cagnotte, cartTotal) : 0;
  const discountAmt = discountType === 'percent'
    ? (cartTotal - cagnotteUsed) * (discount/100)
    : Math.min(discount, cartTotal - cagnotteUsed);
  const finalTotal = Math.max(0, cartTotal - cagnotteUsed - discountAmt);
  const tva = finalTotal * TVA / (1 + TVA);
  const cashback = finalTotal * CASHBACK_RATE;

  const addToCart = useCallback((p, px=null) => {
    const prix = px !== null ? px : p.prix;
    setCart(prev => {
      if (!p.vrac) {
        const ex = prev.find(i => i.id === p.id);
        if (ex) return prev.map(i => i.id === p.id ? {...i, qty: i.qty+1} : i);
      }
      return [...prev, {...p, prix, qty:1, cartId: Date.now()}];
    });
  }, []);

  const removeItem = (cid) => setCart(p => p.filter(i => i.cartId !== cid));
  const updateQty = (cid, d) => setCart(p =>
    p.map(i => i.cartId!==cid ? i : i.qty+d<=0 ? null : {...i, qty:i.qty+d}).filter(Boolean)
  );

  const handleBarcode = (e) => {
    if (e.key==='Enter' && barcode.trim()) {
      const f = allProducts.find(p => p.barcode===barcode.trim());
      if (f) { f.vrac ? setModal('vrac') : addToCart(f); }
      else alert("Produit non trouvé: "+barcode);
      setBarcode('');
    }
  };

  const handleVrac = () => {
    const g = parseFloat(vracG);
    if (!g||g<=0) return;
    const p = allProducts.find(p=>p.vrac)||{id:9999,nom:"Bonbons vrac",categorie:"Bonbons",vrac:true};
    addToCart({...p, nom:`Bonbons vrac (${g}g)`, cartId:Date.now()}, g/100*VRAC_PRICE_PER_100G);
    setVracG(''); setModal(null);
  };

  const searchClient = (q) => {
    if (!q.trim()) { setLoyResults([]); return; }
    const ql = q.toLowerCase();
    setLoyResults(allClients.filter(c =>
      (c.name&&c.name.toLowerCase().includes(ql)) ||
      (c.phone&&c.phone.toLowerCase().includes(ql)) ||
      (c.email&&c.email.toLowerCase().includes(ql))
    ));
  };

  const applyDiscount = () => {
    const v = parseFloat(discountInput.replace(',','.'));
    if (!v||v<=0) { alert("Valeur invalide"); return; }
    setDiscount(v);
    setModal(null);
  };

  const handlePayment = async (method) => {
    if (client) {
      const newCag = cagnotte - cagnotteUsed + cashback;
      await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${client.id}`, {
        method:'PATCH', headers:{...SB,Prefer:"return=minimal"},
        body: JSON.stringify({cagnotte: Math.max(0,newCag)})
      });
    }
    setReceipt({cart:[...cart], cartTotal, cagnotteUsed, discountAmt, finalTotal, tva, cashback, method, client, date:new Date()});
    setModal('receipt');
  };

  const newSale = () => {
    setCart([]); setClient(null); setUseCagnotte(false); setDiscount(0);
    setDiscountInput(''); setModal(null); setReceipt(null); setSearch('');
  };

  // Barcode scanner via camera
  const startBarcodeScanner = () => setShowBarcodeScanner(true);
  const stopBarcodeScanner = () => {
    setShowBarcodeScanner(false);
    if (window._barcodeStream) {
      window._barcodeStream.getTracks().forEach(t => t.stop());
      window._barcodeStream = null;
    }
    clearInterval(window._barcodeInterval);
  };

  const uploadPhoto = async (file) => {
    setUploading(true);
    try {
      const fn = `${Date.now()}.${file.name.split('.').pop()}`;
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/product-photos/${fn}`, {
        method:'POST', headers:{apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}`, "Content-Type":file.type}, body:file
      });
      if (r.ok) setEditProduct(p => ({...p, photo_url:`${SUPABASE_URL}/storage/v1/object/public/product-photos/${fn}`}));
      else alert("Erreur upload");
    } catch(e) { alert("Erreur: "+e.message); }
    setUploading(false);
  };

  const openEdit = (p, nouveau=false) => {
    if (nouveau) { setEditProduct({nom:'',categorie:'Bonbons',prix:'',vrac:false,barcode:'',photo_url:''}); setIsNew(true); }
    else {
      setEditProduct({
        nom:p.nom, categorie:p.categorie, prix:p.prix, vrac:p.vrac,
        barcode:p.barcode, photo_url:p.photo_url||'',
        base_product_id: !String(p.id).startsWith('c_') ? p.id : (p.base_product_id||null),
        custom_id: p.custom_id||null
      });
      setIsNew(false);
    }
  };

  const saveProduct = async () => {
    if (!editProduct.nom||editProduct.prix==='') { alert("Nom et prix requis"); return; }
    setSaving(true);
    const payload = {
      nom:editProduct.nom, categorie:editProduct.categorie,
      prix:parseFloat(String(editProduct.prix).replace(',','.')),
      vrac:editProduct.vrac, barcode:editProduct.barcode||null,
      photo_url:editProduct.photo_url||null, actif:true,
      base_product_id:editProduct.base_product_id!=null?editProduct.base_product_id:null
    };
    try {
      if (editProduct.custom_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/products_custom?id=eq.${editProduct.custom_id}`, {
          method:'PATCH', headers:{...SB,Prefer:"return=minimal"}, body:JSON.stringify(payload)
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/products_custom`, {
          method:'POST', headers:{...SB,Prefer:"return=minimal"}, body:JSON.stringify(payload)
        });
      }
      await loadCustomProducts(); setEditProduct(null);
    } catch(e) { alert("Erreur: "+e.message); }
    setSaving(false);
  };

  const deleteProduct = async (cid) => {
    if (!confirm("Supprimer définitivement ?")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/products_custom?id=eq.${cid}`, {
      method:'PATCH', headers:{...SB,Prefer:"return=minimal"}, body:JSON.stringify({actif:false})
    });
    loadCustomProducts();
  };

  const hideBaseProduct = async (p) => {
    if (!confirm(`Supprimer "${p.nom}" du catalogue ?`)) return;
    await fetch(`${SUPABASE_URL}/rest/v1/products_custom`, {
      method:'POST', headers:{...SB,Prefer:"return=minimal"},
      body:JSON.stringify({nom:p.nom,categorie:p.categorie,prix:p.prix,vrac:p.vrac,barcode:p.barcode||null,photo_url:p.photo_url||null,actif:false,base_product_id:typeof p.id==='number'?p.id:null})
    });
    loadCustomProducts();
  };

  // BOX MYSTÈRE
  const newBox = () => setEditBox({nom:'Box Mystère 10€', prix:10, date:today(), produits:[], notes:''});

  const addToBox = (p) => {
    setEditBox(b => {
      const ex = b.produits.find(i => i.id===p.id);
      if (ex) return {...b, produits: b.produits.map(i => i.id===p.id ? {...i,qty:i.qty+1} : i)};
      return {...b, produits:[...b.produits, {id:p.id, nom:p.nom, prix:p.prix, qty:1}]};
    });
  };

  const removeFromBox = (id) => setEditBox(b => ({...b, produits: b.produits.filter(i=>i.id!==id)}));

  const saveBox = async () => {
    if (!editBox.produits.length) { alert("Ajoutez au moins un produit"); return; }
    const qty = boxQuantite || 1;
    const payload = {
      box_nom: editBox.nom, box_prix: editBox.prix,
      date_vente: editBox.date, produits: JSON.stringify(editBox.produits),
      notes: (editBox.notes||'') + (qty > 1 ? ` [${qty} boxes]` : ''),
      quantite: qty
    };
    await fetch(`${SUPABASE_URL}/rest/v1/box_contents`, {
      method:'POST', headers:{...SB,Prefer:"return=minimal"}, body:JSON.stringify(payload)
    });
    // Déstock automatique
    await deductStock(editBox.produits, qty);
    await loadBoxes(); await loadStock();
    setEditBox(null); setBoxQuantite(1);
    alert(`✅ ${qty} box(es) enregistrée(s) — stock mis à jour !`);
  };

  const deleteBox = async (id) => {
    if (!confirm("Supprimer cette box ?")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/box_contents?id=eq.${id}`, {
      method:'DELETE', headers:SB
    });
    loadBoxes();
  };

  const printBox = (box) => {
    const produits = typeof box.produits==='string' ? JSON.parse(box.produits) : box.produits;
    const total = produits.reduce((s,p)=>s+p.prix*p.qty,0);
    const w = window.open('','_blank');
    w.document.write(`
      <html><head><title>Box Mystère</title>
      <style>body{font-family:monospace;padding:20px;max-width:400px;margin:auto}
      h2{color:#e91e8c}table{width:100%;border-collapse:collapse}
      td,th{border:1px solid #ddd;padding:6px;text-align:left}
      .total{font-weight:bold;font-size:18px}</style></head>
      <body>
        <h2>🍬 MUNCHY'S CANDY</h2>
        <p><b>${box.box_nom}</b> — ${box.date_vente}</p>
        <p>TVA BE 0750.497.413</p>
        <hr>
        <table>
          <tr><th>Produit</th><th>Qté</th><th>Prix</th></tr>
          ${produits.map(p=>`<tr><td>${p.nom}</td><td>${p.qty}</td><td>${(p.prix*p.qty).toFixed(2)}€</td></tr>`).join('')}
        </table>
        <hr>
        <p class="total">Contenu total: ${total.toFixed(2)}€</p>
        <p>Prix de vente: ${box.box_prix}€</p>
        ${box.notes?`<p>Notes: ${box.notes}</p>`:''}
        <p style="color:#888;font-size:11px">Généré le ${new Date().toLocaleString('fr-BE')}</p>
        <script>window.print();window.close();</script>
      </body></html>
    `);
  };

  const sendEmail = async () => {
    if (!emailSubject||!emailBody) { alert("Remplissez tous les champs"); return; }
    setSendingEmail(true);
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method:"POST",
        headers:{"Authorization":"Bearer re_PGnLJC4M_7XzWAhEPeJq7i9nQaBqEMBJn","Content-Type":"application/json"},
        body:JSON.stringify({
          from:"contact@munchyscandy.fr", to:[emailClient.email],
          subject:emailSubject,
          html:`<div style="font-family:sans-serif;max-width:600px;margin:auto">
            <h2 style="color:#e91e8c">🍬 Munchy's Candy</h2>
            <p>${emailBody.replace(/\n/g,'<br>')}</p>
            <hr><p style="color:#888;font-size:12px">Munchy's Candy · Mouscron, Belgique</p>
          </div>`
        })
      });
      if (r.ok) { alert(`✅ Email envoyé !`); setEmailClient(null); setEmailSubject(''); setEmailBody(''); }
      else { const e=await r.json(); alert("Erreur: "+(e.message||'inconnue')); }
    } catch(e) { alert("Erreur: "+e.message); }
    setSendingEmail(false);
  };

  const boxFilteredProducts = allProducts.filter(p =>
    !boxSearch || p.nom.toLowerCase().includes(boxSearch.toLowerCase())
  );

  const settingsProducts = allProducts.filter(p =>
    !settingsSearch || p.nom.toLowerCase().includes(settingsSearch.toLowerCase())
  );

  return (
    <div style={S.app}>
      {/* HEADER */}
      <div style={S.header}>
        <div style={S.logo}>🍬 MUNCHY'S</div>
        <div style={{flex:1}}>
          <input style={S.searchInput} placeholder="Rechercher un produit..."
            value={search} onChange={e=>setSearch(e.target.value)}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"/>
        </div>
        <div style={S.hRight}>
          <input style={S.barcodeInput} placeholder="Code-barres..."
            value={barcode} onChange={e=>setBarcode(e.target.value)} onKeyDown={handleBarcode}/>
          <button style={S.btnW} onClick={()=>setModal('vrac')}>⚖️</button>
          <button style={S.btnD} onClick={()=>{setModal('loyalty');setLoySearch('');setLoyResults([]);loadClients();}}>💳</button>
          <button style={S.btnD} onClick={()=>{setShowSettings(true);loadStock();}}>⚙️</button>
        </div>
      </div>

      <div style={S.main}>
        {/* LEFT */}
        <div style={S.left}>
          <div style={S.catBar}>
            {CATS.map(c=>(
              <button key={c} style={{...S.catBtn,...(activeCat===c?S.catActive:{})}} onClick={()=>setActiveCat(c)}>
                {c==='TOUT'?'🍭 TOUT':`${EMO[c]||'•'} ${c}`}
              </button>
            ))}
          </div>
          <div style={S.grid}>
            {filtered.map(p=>(
              <button key={p.id} style={{...S.card,...(p.vrac?S.cardVrac:{})}}
                onClick={()=>p.vrac?setModal('vrac'):addToCart(p)}>
                {p.photo_url
                  ? <img src={p.photo_url} style={S.cardImg} onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='block'}}/>
                  : null}
                <div style={{fontSize:22, display:p.photo_url?'none':'block'}}>{EMO[p.categorie]||'🍬'}</div>
                <div style={S.cardName}>{p.nom}</div>
                <div style={S.cardPrice}>{p.vrac?`${p.prix.toFixed(2)}€/100g`:`${p.prix.toFixed(2)}€`}</div>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div style={S.right}>
          <div style={S.cartHead}>
            🛒 CAISSE
            {client && (
              <div style={S.loyCard}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontWeight:800,fontSize:13}}>💳 {client.name}</span>
                  <button style={S.btnX} onClick={()=>{setClient(null);setUseCagnotte(false);}}>✕</button>
                </div>
                <div style={{fontSize:12,color:'#aaa',margin:'3px 0'}}>
                  Cagnotte: <b style={{color:'#e91e8c'}}>{cagnotte.toFixed(2)}€</b>
                </div>
                {cagnotte>0 && (
                  <div style={{display:'flex',gap:5,marginTop:5}}>
                    <button style={{...S.cogBtn,...(useCagnotte?S.cogOn:{})}} onClick={()=>setUseCagnotte(true)}>
                      ✅ -{Math.min(cagnotte,cartTotal).toFixed(2)}€
                    </button>
                    <button style={{...S.cogBtn,...(!useCagnotte?S.cogOff:{})}} onClick={()=>setUseCagnotte(false)}>
                      ❌ Garder
                    </button>
                  </div>
                )}
                {client.email && (
                  <button style={S.emailBtn} onClick={()=>{setEmailClient(client);setEmailSubject("Un message de Munchy's 🍬");setEmailBody(`Bonjour ${client.name},\n\n`);}}>
                    ✉️ Envoyer un email
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={S.items}>
            {!cart.length && <div style={S.empty}>Aucun article</div>}
            {cart.map(item=>(
              <div key={item.cartId} style={S.item}>
                <div style={S.iName}>{item.nom}</div>
                <div style={S.iRow}>
                  {!item.vrac && <>
                    <button style={S.qBtn} onClick={()=>updateQty(item.cartId,-1)}>−</button>
                    <span style={S.qNum}>{item.qty}</span>
                    <button style={S.qBtn} onClick={()=>updateQty(item.cartId,1)}>+</button>
                  </>}
                  <span style={{marginLeft:'auto',fontSize:13,fontWeight:800}}>{(item.prix*item.qty).toFixed(2)}€</span>
                  <button style={S.xBtn} onClick={()=>confirm(`Supprimer "${item.nom}" ?`)&&removeItem(item.cartId)}>✕</button>
                </div>
              </div>
            ))}
          </div>

          <div style={S.footer}>
            {cagnotteUsed>0 && <div style={S.discRow}><span>🎁 Cagnotte</span><span>−{fmt(cagnotteUsed)}</span></div>}
            {discountAmt>0 && <div style={S.discRow}><span>💸 Remise {discountType==='percent'?`${discount}%`:''}</span><span>−{fmt(discountAmt)}</span></div>}
            <div style={S.totalRow}><span>TOTAL TTC</span><span style={S.totalAmt}>{fmt(finalTotal)}</span></div>
            <div style={S.tvaRow}><span>dont TVA 6%</span><span>{fmt(tva)}</span></div>
            {client && <div style={S.tvaRow}><span>Cashback +5%</span><span style={{color:'#e91e8c'}}>+{fmt(cashback)}</span></div>}
            <div style={{display:'flex',gap:6}}>
              <button style={{...S.payBtn,...S.payCard}} onClick={()=>cart.length>0&&setModal('payment')} disabled={!cart.length}>💳 CARTE</button>
              <button style={{...S.payBtn,...S.payCash}} onClick={()=>cart.length>0&&handlePayment('espèces')} disabled={!cart.length}>💵 ESPÈCES</button>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button style={S.remiseBtn} onClick={()=>{setDiscountInput('');setModal('discount');}}>💸 Remise</button>
              {discount>0 && <button style={S.clearRemise} onClick={()=>setDiscount(0)}>✕ Remise</button>}
            </div>
            <button style={S.clearBtn} onClick={newSale}>🗑️ Vider</button>
          </div>
        </div>
      </div>

      {/* ======= SETTINGS ======= */}
      {showSettings && (
        <div style={S.settingsOverlay}>
          <div style={S.settingsPanel}>
            <div style={S.settingsHead}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button style={{...S.tabBtn,...(settingsTab==='produits'?S.tabActive:{})}} onClick={()=>setSettingsTab('produits')}>🛍️ Produits</button>
                <button style={{...S.tabBtn,...(settingsTab==='box'?S.tabActive:{})}} onClick={()=>setSettingsTab('box')}>📦 Box Mystère</button>
                <button style={{...S.tabBtn,...(settingsTab==='stock'?S.tabActive:{})}} onClick={()=>{setSettingsTab('stock');loadStock();}}>📊 Stock</button>
              </div>
              <div style={{display:'flex',gap:8}}>
                {settingsTab==='produits' && <button style={S.btnAdd} onClick={()=>openEdit(null,true)}>+ Nouveau</button>}
                {settingsTab==='box' && <button style={S.btnAdd} onClick={newBox}>+ Nouvelle box</button>}
                <button style={S.settingsClose} onClick={()=>setShowSettings(false)}>✕</button>
              </div>
            </div>

            {/* PRODUITS TAB */}
            {settingsTab==='produits' && (
              <>
                <input style={S.settingsSearch} placeholder="Rechercher..." value={settingsSearch} onChange={e=>setSettingsSearch(e.target.value)} autoComplete="off"/>
                <div style={S.settingsList}>
                  {settingsProducts.slice(0,200).map(p=>(
                    <div key={p.id} style={S.sItem}>
                      {p.photo_url
                        ? <img src={p.photo_url} style={S.sThumb} onError={e=>e.target.style.display='none'}/>
                        : <div style={{fontSize:24,width:40,textAlign:'center'}}>{EMO[p.categorie]||'🍬'}</div>}
                      <div style={{flex:1,overflow:'hidden'}}>
                        <div style={{fontSize:13,fontWeight:700,color:'#ddd',textOverflow:'ellipsis',overflow:'hidden',whiteSpace:'nowrap'}}>{p.nom}</div>
                        <div style={{fontSize:11,color:'#888'}}>{p.categorie} · {p.vrac?`${p.prix.toFixed(2)}€/100g`:`${p.prix.toFixed(2)}€`}{p.barcode?` · ${p.barcode}`:''}</div>
                      </div>
                      <div style={{display:'flex',gap:5,flexShrink:0}}>
                        <button style={S.editBtn} onClick={()=>openEdit(p)}>✏️</button>
                        {p.custom_id
                          ? <button style={S.delBtn} onClick={()=>deleteProduct(p.custom_id)}>🗑️</button>
                          : <button style={S.delBtn} title="Supprimer du catalogue" onClick={()=>hideBaseProduct(p)}>🗑️</button>
                        }
                      </div>
                    </div>
                  ))}
                  {settingsProducts.length>200 && <div style={{color:'#888',padding:12,textAlign:'center',fontSize:12}}>Affinez la recherche</div>}
                </div>
              </>
            )}

            {/* BOX TAB */}
            {settingsTab==='box' && (
              <div style={S.settingsList}>
                {!boxes.length && <div style={{color:'#888',textAlign:'center',padding:30}}>Aucune box enregistrée</div>}
                {boxes.map(b=>{
                  const prods = typeof b.produits==='string' ? JSON.parse(b.produits) : b.produits;
                  return (
                    <div key={b.id} style={{...S.sItem,flexDirection:'column',alignItems:'flex-start',gap:6}}>
                      <div style={{display:'flex',justifyContent:'space-between',width:'100%',alignItems:'center'}}>
                        <div>
                          <div style={{fontWeight:800,fontSize:14,color:'#fff'}}>📦 {b.box_nom}</div>
                          <div style={{fontSize:12,color:'#aaa'}}>{b.date_vente} · {prods.length} produit(s) · total contenu: {prods.reduce((s,p)=>s+p.prix*p.qty,0).toFixed(2)}€</div>
                        </div>
                        <div style={{display:'flex',gap:6}}>
                          <button style={{...S.editBtn,background:'rgba(76,175,80,0.2)',color:'#4caf50'}} onClick={()=>printBox(b)}>🖨️ PDF</button>
                          <button style={S.delBtn} onClick={()=>deleteBox(b.id)}>🗑️</button>
                        </div>
                      </div>
                      <div style={{fontSize:12,color:'#ccc',paddingLeft:4}}>
                        {prods.map(p=>`${p.nom} x${p.qty}`).join(' · ')}
                      </div>
                      {b.notes && <div style={{fontSize:11,color:'#888',fontStyle:'italic'}}>📝 {b.notes}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* STOCK TAB */}
            {settingsTab==='stock' && (
              <>
                <input style={S.settingsSearch} placeholder="Rechercher un produit..." value={stockSearch} onChange={e=>setStockSearch(e.target.value)} autoComplete="off"/>
                <div style={{padding:'4px 16px 8px',fontSize:12,color:'#888'}}>{allProducts.length} produits · Cliquez pour modifier le stock · 🟢 OK · 🟡 Bas · 🔴 Vide · ⬜ Non saisi</div>
                <div style={S.settingsList}>
                  {allProducts.filter(p=>!stockSearch||p.nom.toLowerCase().includes(stockSearch.toLowerCase())).slice(0,300).map(p=>{
                    const s = stockData.find(sd=>sd.product_nom===p.nom);
                    const qty = s ? s.quantite : null;
                    const seuil = s ? s.seuil_alerte : 5;
                    const dot = qty===null?'⬜':qty<=0?'🔴':qty<=seuil?'🟡':'🟢';
                    const color = qty===null?'#555':qty<=0?'#ff5555':qty<=seuil?'#ffa500':'#4caf50';
                    return (
                      <div key={p.id} style={{...S.sItem,cursor:'pointer'}}
                        onClick={()=>{setEditingStock(p);setStockQty(qty!==null?String(qty):'0');setStockAlert(String(seuil));}}>
                        <div style={{fontSize:20,width:30,textAlign:'center',flexShrink:0}}>{dot}</div>
                        <div style={{flex:1,overflow:'hidden'}}>
                          <div style={{fontSize:13,fontWeight:700,color:'#ddd',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.nom}</div>
                          <div style={{fontSize:11,color:'#777'}}>{p.categorie}</div>
                        </div>
                        <div style={{textAlign:'right',flexShrink:0,marginRight:8}}>
                          <div style={{fontSize:20,fontWeight:900,color,lineHeight:1}}>{qty!==null?qty:'—'}</div>
                          <div style={{fontSize:10,color:'#555'}}>unités</div>
                        </div>
                        {s && qty>0 && (
                          <button style={{...S.editBtn,background:'rgba(76,175,80,0.15)',color:'#4caf50',fontSize:12,padding:'5px 8px'}}
                            onClick={e=>{
                              e.stopPropagation();
                              const n=parseInt(prompt(`Ajouter combien d'unités à "${p.nom}" ?`)||'0');
                              if(n>0) addStock(p.nom,n);
                            }}>+</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* EDIT STOCK MODAL */}
      {editingStock && (
        <div style={S.overlay}>
          <div style={{...S.modal,width:380}}>
            <h2 style={S.mTitle}>📊 {editingStock.nom}</h2>
            <div style={{display:'flex',flexDirection:'column',gap:14,marginBottom:18}}>
              <div>
                <label style={{fontSize:13,color:'#888',fontWeight:700,display:'block',marginBottom:7}}>Quantité actuelle en stock</label>
                <input style={{...S.eInput,fontSize:32,textAlign:'center',fontWeight:900,padding:'14px'}} type="number" min="0" value={stockQty} onChange={e=>setStockQty(e.target.value)} autoFocus/>
              </div>
              <div>
                <label style={{fontSize:13,color:'#888',fontWeight:700,display:'block',marginBottom:7}}>Seuil d'alerte stock bas</label>
                <input style={S.eInput} type="number" min="0" value={stockAlert} onChange={e=>setStockAlert(e.target.value)} placeholder="Ex: 5"/>
              </div>
            </div>
            <div style={S.mBtns}>
              <button style={S.btnCancel} onClick={()=>setEditingStock(null)}>Annuler</button>
              <button style={S.btnConfirm} onClick={async()=>{
                await upsertStock(editingStock.nom,parseInt(stockQty)||0,parseInt(stockAlert)||5);
                setEditingStock(null);
              }}>💾 Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT BOX MODAL */}
      {editBox && (
        <div style={S.overlay}>
          <div style={{...S.modal,width:600,maxHeight:'90vh',overflowY:'auto'}}>
            <h2 style={S.mTitle}>📦 Préparer une Box Mystère</h2>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:14}}>
              <div>
                <label style={S.eLabel}>Type</label>
                <select style={S.eInput} value={editBox.nom} onChange={e=>setEditBox(b=>({...b,nom:e.target.value,prix:e.target.value.includes('20')?20:10}))}>
                  <option value="Box Mystère 10€">Box Mystère 10€</option>
                  <option value="Box Mystère 20€">Box Mystère 20€</option>
                </select>
              </div>
              <div>
                <label style={S.eLabel}>Date</label>
                <input type="date" style={S.eInput} value={editBox.date} onChange={e=>setEditBox(b=>({...b,date:e.target.value}))}/>
              </div>
              <div>
                <label style={S.eLabel}>Prix vente</label>
                <input type="number" style={S.eInput} value={editBox.prix} onChange={e=>setEditBox(b=>({...b,prix:parseFloat(e.target.value)}))}/>
              </div>
              <div>
                <label style={S.eLabel}>Nb de boxes 📦</label>
                <input type="number" style={{...S.eInput,fontWeight:900,fontSize:18}} min="1" value={boxQuantite} onChange={e=>setBoxQuantite(parseInt(e.target.value)||1)}/>
              </div>
            </div>

            <div style={{display:'flex',gap:12,marginBottom:14}}>
              {/* Produits sélectionnés */}
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:'#e91e8c',marginBottom:6,fontSize:13}}>📋 Contenu de la box :</div>
                {!editBox.produits.length && <div style={{color:'#666',fontSize:12}}>Aucun produit ajouté</div>}
                {editBox.produits.map(p=>(
                  <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 8px',background:'rgba(233,30,140,0.08)',borderRadius:7,marginBottom:4}}>
                    <span style={{fontSize:12,color:'#ddd'}}>{p.nom} x{p.qty}</span>
                    <span style={{fontSize:12,color:'#e91e8c',fontWeight:700}}>{(p.prix*p.qty).toFixed(2)}€</span>
                    <button style={{...S.xBtn,width:18,height:18}} onClick={()=>removeFromBox(p.id)}>✕</button>
                  </div>
                ))}
                {editBox.produits.length>0 && (
                  <div style={{fontWeight:700,color:'#4caf50',fontSize:13,marginTop:8}}>
                    Total contenu: {editBox.produits.reduce((s,p)=>s+p.prix*p.qty,0).toFixed(2)}€
                  </div>
                )}
                <textarea style={{...S.eInput,width:'100%',minHeight:60,marginTop:10,resize:'vertical'}}
                  placeholder="Notes pour le comptable..." value={editBox.notes||''}
                  onChange={e=>setEditBox(b=>({...b,notes:e.target.value}))}/>
              </div>

              {/* Catalogue */}
              <div style={{flex:1}}>
                <input style={S.settingsSearch} placeholder="Chercher un produit..." value={boxSearch} onChange={e=>setBoxSearch(e.target.value)} autoComplete="off"/>
                <div style={{maxHeight:280,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
                  {boxFilteredProducts.slice(0,100).map(p=>(
                    <button key={p.id} style={{padding:'6px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)',color:'#ddd',cursor:'pointer',textAlign:'left',fontSize:12,fontFamily:"'Nunito',sans-serif"}}
                      onClick={()=>addToBox(p)}>
                      <b style={{color:'#e91e8c'}}>{p.prix.toFixed(2)}€</b> · {p.nom}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={S.mBtns}>
              <button style={S.btnCancel} onClick={()=>setEditBox(null)}>Annuler</button>
              <button style={S.btnConfirm} onClick={saveBox}>💾 Enregistrer la box</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT */}
      {editProduct && (
        <div style={S.overlay}>
          <div style={{...S.modal,width:480}}>
            <h2 style={S.mTitle}>{isNew?'➕ Nouveau produit':'✏️ Modifier'}</h2>
            <div style={S.eGrid}>
              <label style={S.eLabel}>Nom *</label>
              <input style={S.eInput} value={editProduct.nom} onChange={e=>setEditProduct(p=>({...p,nom:e.target.value}))}/>
              <label style={S.eLabel}>Catégorie</label>
              <select style={S.eInput} value={editProduct.categorie} onChange={e=>setEditProduct(p=>({...p,categorie:e.target.value}))}>
                {ALL_CATS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <label style={S.eLabel}>Prix €</label>
              <input style={S.eInput} type="number" step="0.01" value={editProduct.prix} onChange={e=>setEditProduct(p=>({...p,prix:e.target.value}))}/>
              <label style={S.eLabel}>Barcode</label>
              <div style={{display:'flex',gap:8}}>
                <input style={{...S.eInput,flex:1}} value={editProduct.barcode} onChange={e=>setEditProduct(p=>({...p,barcode:e.target.value}))} placeholder="Ex: 5011061181329"/>
                <button style={{...S.uploadBtn,padding:'8px 12px',fontSize:16,flexShrink:0}} onClick={startBarcodeScanner} title="Scanner avec la caméra">📷</button>
              </div>
              <label style={S.eLabel}>Photo</label>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                <label style={{...S.uploadBtn,opacity:uploading?0.6:1}}>
                  {uploading?'⏳...':'📷 Choisir photo'}
                  <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files[0]&&uploadPhoto(e.target.files[0])} disabled={uploading}/>
                </label>
                {editProduct.photo_url && (
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <img src={editProduct.photo_url} style={{width:50,height:50,objectFit:'cover',borderRadius:8}} onError={e=>e.target.style.display='none'}/>
                    <button style={{...S.delBtn,fontSize:11}} onClick={()=>setEditProduct(p=>({...p,photo_url:''}))}>Supprimer</button>
                  </div>
                )}
                <input style={{...S.eInput,fontSize:11}} placeholder="ou URL..." value={editProduct.photo_url} onChange={e=>setEditProduct(p=>({...p,photo_url:e.target.value}))}/>
              </div>
              <label style={S.eLabel}>Vrac</label>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="checkbox" checked={editProduct.vrac} onChange={e=>setEditProduct(p=>({...p,vrac:e.target.checked}))} style={{width:18,height:18}}/>
                <span style={{color:'#888',fontSize:13}}>Prix au 100g</span>
              </div>
            </div>
            <div style={S.mBtns}>
              <button style={S.btnCancel} onClick={()=>setEditProduct(null)}>Annuler</button>
              <button style={S.btnConfirm} onClick={saveProduct} disabled={saving||uploading}>{saving?'...':'💾 Sauvegarder'}</button>
            </div>
          </div>
        </div>
      )}

      {/* DISCOUNT MODAL */}
      {modal==='discount' && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <h2 style={S.mTitle}>💸 Appliquer une remise</h2>
            <div style={{display:'flex',gap:8,marginBottom:16}}>
              <button style={{...S.cogBtn,...(discountType==='percent'?S.cogOn:{})}} onClick={()=>setDiscountType('percent')}>% Pourcentage</button>
              <button style={{...S.cogBtn,...(discountType==='fixed'?S.cogOn:{})}} onClick={()=>setDiscountType('fixed')}>€ Montant fixe</button>
            </div>
            <input style={{...S.eInput,fontSize:20,textAlign:'center',marginBottom:16}}
              placeholder={discountType==='percent'?'Ex: 10 (pour 10%)':'Ex: 5 (pour 5€)'}
              value={discountInput} onChange={e=>setDiscountInput(e.target.value)}
              autoFocus/>
            <div style={S.mBtns}>
              <button style={S.btnCancel} onClick={()=>setModal(null)}>Annuler</button>
              <button style={S.btnConfirm} onClick={applyDiscount}>✓ Appliquer</button>
            </div>
          </div>
        </div>
      )}

      {/* LOYALTY MODAL */}
      {modal==='loyalty' && (
        <div style={S.overlay}>
          <div style={{...S.modal,width:460}}>
            <h2 style={S.mTitle}>💳 Carte fidélité</h2>
            <p style={{color:'#888',fontSize:13,textAlign:'center',marginBottom:10}}>QR code, téléphone ou nom</p>
            <p style={{color:allClients.length>0?'#4caf50':'#ff5555',fontSize:12,textAlign:'center',marginBottom:10}}>
              {allClients.length>0?`✅ ${allClients.length} clients`:'⏳ Chargement...'}
            </p>
            <input style={{...S.eInput,marginBottom:10,fontSize:15}}
              placeholder="Rechercher..." value={loySearch}
              onChange={e=>{setLoySearch(e.target.value);searchClient(e.target.value);}} autoFocus/>
            {loyResults.length>0 && (
              <div style={{maxHeight:220,overflowY:'auto',marginBottom:14,display:'flex',flexDirection:'column',gap:5}}>
                {loyResults.map(c=>(
                  <button key={c.id} style={{padding:'10px 14px',borderRadius:10,border:'1px solid rgba(233,30,140,0.2)',background:'rgba(233,30,140,0.05)',color:'#fff',cursor:'pointer',textAlign:'left'}}
                    onClick={()=>{setClient(c);setUseCagnotte(false);setModal(null);setLoySearch('');setLoyResults([]);}}>
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{fontWeight:700}}>{c.name}</span>
                      <span style={{color:'#e91e8c',fontWeight:800}}>💰 {(c.cagnotte||0).toFixed(2)}€</span>
                    </div>
                    <div style={{fontSize:12,color:'#aaa'}}>{c.phone||''}{c.email?` · ${c.email}`:''}</div>
                  </button>
                ))}
              </div>
            )}
            {loySearch.length>1&&!loyResults.length && <div style={{color:'#888',textAlign:'center',marginBottom:14}}>Aucun client trouvé</div>}
            <button style={S.btnCancel} onClick={()=>{setModal(null);setLoySearch('');setLoyResults([]);}}>Annuler</button>
          </div>
        </div>
      )}

      {/* VRAC MODAL */}
      {modal==='vrac' && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <h2 style={S.mTitle}>⚖️ Bonbons en vrac</h2>
            <p style={{color:'#888',fontSize:13,textAlign:'center',marginBottom:16}}>1,50€ / 100g</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:14}}>
              {['1','2','3','4','5','6','7','8','9','0','00','⌫'].map(k=>(
                <button key={k} style={{padding:14,borderRadius:10,border:'none',background:'rgba(255,255,255,0.08)',color:'#fff',fontSize:18,fontWeight:800,cursor:'pointer'}}
                  onClick={()=>k==='⌫'?setVracG(v=>v.slice(0,-1)):setVracG(v=>v+k)}>{k}</button>
              ))}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',background:'rgba(233,30,140,0.1)',borderRadius:10,padding:'12px 16px',marginBottom:16}}>
              <span style={{fontSize:24,fontWeight:900}}>{vracG||'0'} g</span>
              <span style={{fontSize:20,fontWeight:900,color:'#e91e8c'}}>= {((parseFloat(vracG)||0)/100*VRAC_PRICE_PER_100G).toFixed(2)}€</span>
            </div>
            <div style={S.mBtns}>
              <button style={S.btnCancel} onClick={()=>{setModal(null);setVracG('');}}>Annuler</button>
              <button style={S.btnConfirm} onClick={handleVrac}>Ajouter ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {modal==='payment' && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <h2 style={S.mTitle}>💳 Paiement carte</h2>
            <div style={{fontSize:44,fontWeight:900,color:'#e91e8c',textAlign:'center',margin:'18px 0'}}>{fmt(finalTotal)}</div>
            <p style={{color:'#888',fontSize:13,textAlign:'center',marginBottom:20}}>Présentez le terminal myPOS Go 2</p>
            <div style={S.mBtns}>
              <button style={S.btnCancel} onClick={()=>setModal(null)}>Annuler</button>
              <button style={S.btnConfirm} onClick={()=>handlePayment('carte')}>Paiement reçu ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {modal==='receipt' && receipt && (
        <div style={S.overlay}>
          <div style={{...S.modal,width:370,maxHeight:'90vh',overflowY:'auto'}}>
            <div id="receipt" style={{fontFamily:'monospace',fontSize:12,lineHeight:1.6,color:'#ddd',paddingBottom:16}}>
              <div style={{textAlign:'center',marginBottom:8}}>
                <div style={{fontSize:16,fontWeight:900,color:'#e91e8c'}}>🍬 MUNCHY'S CANDY</div>
                <div style={{fontSize:10,color:'#888'}}>Mouscron · TVA BE 0750.497.413</div>
                <div style={{fontSize:10,color:'#888'}}>{receipt.date.toLocaleString('fr-BE')}</div>
              </div>
              <div style={{color:'#444',margin:'6px 0'}}>{'─'.repeat(32)}</div>
              {receipt.cart.map((i,n)=>(
                <div key={n} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'1px 0'}}>
                  <span>{i.nom} x{i.qty}</span><span>{(i.prix*i.qty).toFixed(2)}€</span>
                </div>
              ))}
              <div style={{color:'#444',margin:'6px 0'}}>{'─'.repeat(32)}</div>
              <div style={{display:'flex',justifyContent:'space-between'}}><span>Sous-total</span><span>{receipt.cartTotal.toFixed(2)}€</span></div>
              {receipt.cagnotteUsed>0 && <div style={{display:'flex',justifyContent:'space-between',color:'#e91e8c'}}><span>🎁 Cagnotte</span><span>−{receipt.cagnotteUsed.toFixed(2)}€</span></div>}
              {receipt.discountAmt>0 && <div style={{display:'flex',justifyContent:'space-between',color:'#ff9800'}}><span>💸 Remise</span><span>−{receipt.discountAmt.toFixed(2)}€</span></div>}
              <div style={{display:'flex',justifyContent:'space-between',fontWeight:'bold',fontSize:16}}><span>TOTAL TTC</span><span>{receipt.finalTotal.toFixed(2)}€</span></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#888'}}><span>dont TVA 6%</span><span>{receipt.tva.toFixed(2)}€</span></div>
              <div style={{display:'flex',justifyContent:'space-between'}}><span>Paiement</span><span>{receipt.method==='carte'?'💳 Carte':'💵 Espèces'}</span></div>
              {receipt.client && <>
                <div style={{color:'#444',margin:'6px 0'}}>{'─'.repeat(32)}</div>
                <div style={{display:'flex',justifyContent:'space-between',color:'#e91e8c'}}><span>💳 Cashback</span><span>+{receipt.cashback.toFixed(2)}€</span></div>
                <div style={{display:'flex',justifyContent:'space-between',color:'#4caf50',fontWeight:700}}><span>Nouveau solde</span><span>{(Math.max(0,(receipt.client.cagnotte||0)-receipt.cagnotteUsed+receipt.cashback)).toFixed(2)}€</span></div>
              </>}
              <div style={{color:'#444',margin:'6px 0'}}>{'─'.repeat(32)}</div>
              <div style={{textAlign:'center',color:'#e91e8c',fontWeight:700}}>Merci de votre visite ! 🍬</div>
            </div>
            <div style={S.mBtns}>
              <button style={S.btnCancel} onClick={()=>window.print()}>🖨️ Imprimer</button>
              <button style={S.btnConfirm} onClick={newSale}>Nouvelle vente ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL MODAL */}
      {emailClient && (
        <div style={S.overlay}>
          <div style={{...S.modal,width:500}}>
            <h2 style={S.mTitle}>✉️ Email à {emailClient.name}</h2>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
              <input style={S.eInput} placeholder="Sujet..." value={emailSubject} onChange={e=>setEmailSubject(e.target.value)}/>
              <textarea style={{...S.eInput,minHeight:140,resize:'vertical'}} placeholder="Message..." value={emailBody} onChange={e=>setEmailBody(e.target.value)}/>
            </div>
            <div style={S.mBtns}>
              <button style={S.btnCancel} onClick={()=>{setEmailClient(null);setEmailSubject('');setEmailBody('');}}>Annuler</button>
              <button style={S.btnConfirm} onClick={sendEmail} disabled={sendingEmail}>{sendingEmail?'Envoi...':'✉️ Envoyer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* BARCODE SCANNER MODAL */}
      {showBarcodeScanner && editProduct && (
        <div style={{...S.overlay,zIndex:400}}>
          <div style={{...S.modal,width:400,textAlign:'center'}}>
            <h2 style={S.mTitle}>📷 Scanner le code-barres</h2>
            <p style={{color:'#888',fontSize:13,marginBottom:14}}>Pointez la caméra vers le code-barres</p>
            <div style={{position:'relative',borderRadius:14,overflow:'hidden',background:'#000',marginBottom:14}}>
              <video id="barcode-video" autoPlay playsInline muted style={{width:'100%',maxHeight:260,display:'block'}}
                ref={el => {
                  if (el && !window._barcodeStream) {
                    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
                      .then(stream => {
                        window._barcodeStream = stream;
                        el.srcObject = stream;
                        if ('BarcodeDetector' in window) {
                          const detector = new BarcodeDetector({formats:['ean_13','ean_8','code_128','code_39','upc_a','upc_e','qr_code']});
                          window._barcodeInterval = setInterval(async () => {
                            try {
                              const codes = await detector.detect(el);
                              if (codes.length > 0) {
                                const val = codes[0].rawValue;
                                setEditProduct(p => ({...p, barcode: val}));
                                stopBarcodeScanner();
                                alert('✅ Code-barres détecté : ' + val);
                              }
                            } catch(e) {}
                          }, 300);
                        } else {
                          alert("BarcodeDetector non supporté sur ce navigateur. Essayez Chrome/Edge.");
                          stopBarcodeScanner();
                        }
                      })
                      .catch(e => { alert("Caméra inaccessible: "+e.message); stopBarcodeScanner(); });
                  }
                }}
              />
              <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:200,height:120,border:'2px solid #e91e8c',borderRadius:8,boxShadow:'0 0 0 1000px rgba(0,0,0,0.3)'}}/>
            </div>
            <button style={S.btnCancel} onClick={stopBarcodeScanner}>✕ Annuler</button>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Nunito',sans-serif;background:#0a0a18}
        button:disabled{opacity:0.4;cursor:not-allowed}
        button:active{transform:scale(0.97)}
        select option{background:#14142a;color:#fff}
        input::placeholder{color:rgba(255,255,255,0.45)}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(233,30,140,0.3);border-radius:4px}
        @media print{body *{visibility:hidden}#receipt,#receipt *{visibility:visible}#receipt{position:fixed;left:0;top:0;background:white;color:black;padding:20px}}
      `}</style>
    </div>
  );
}

const S = {
  // App shell
  app:{display:'flex',flexDirection:'column',height:'100vh',background:'linear-gradient(160deg,#0a0a18 0%,#12122a 100%)',color:'#fff',fontFamily:"'Nunito',sans-serif",overflow:'hidden'},
  
  // Header - premium glassmorphism
  header:{display:'flex',alignItems:'center',gap:12,padding:'10px 18px',background:'linear-gradient(135deg,#e91e8c 0%,#9c27b0 50%,#ff6b35 100%)',boxShadow:'0 4px 30px rgba(233,30,140,0.5)',flexShrink:0,borderBottom:'1px solid rgba(255,255,255,0.15)'},
  logo:{fontSize:22,fontWeight:900,color:'#fff',whiteSpace:'nowrap',letterSpacing:'-0.5px',textShadow:'0 2px 8px rgba(0,0,0,0.3)'},
  hRight:{display:'flex',gap:8,alignItems:'center',flexShrink:0},
  searchInput:{width:'100%',padding:'9px 16px',borderRadius:14,border:'2px solid rgba(255,255,255,0.25)',background:'rgba(255,255,255,0.15)',color:'#fff',fontSize:14,fontFamily:"'Nunito',sans-serif",fontWeight:600,outline:'none',backdropFilter:'blur(10px)',transition:'border 0.2s'},
  barcodeInput:{width:150,padding:'8px 12px',borderRadius:12,border:'2px solid rgba(255,255,255,0.15)',background:'rgba(0,0,0,0.25)',color:'#fff',fontSize:13,outline:'none',backdropFilter:'blur(5px)'},
  btnW:{padding:'8px 14px',borderRadius:12,border:'none',background:'rgba(255,255,255,0.95)',color:'#e91e8c',fontWeight:800,fontSize:14,cursor:'pointer',boxShadow:'0 2px 10px rgba(0,0,0,0.2)',transition:'transform 0.1s'},
  btnD:{padding:'8px 14px',borderRadius:12,border:'2px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.1)',color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer',backdropFilter:'blur(5px)'},
  
  // Main layout
  main:{display:'flex',flex:1,overflow:'hidden'},
  left:{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'},
  
  // Category bar - colorful pills
  catBar:{display:'flex',gap:6,padding:'10px 12px',overflowX:'auto',flexShrink:0,background:'rgba(255,255,255,0.03)',borderBottom:'1px solid rgba(255,255,255,0.06)',scrollbarWidth:'none'},
  catBtn:{padding:'6px 14px',borderRadius:24,border:'none',background:'rgba(255,255,255,0.06)',color:'#bbb',fontWeight:700,fontSize:11,cursor:'pointer',whiteSpace:'nowrap',transition:'all 0.2s',letterSpacing:'0.3px'},
  catActive:{background:'linear-gradient(135deg,#e91e8c,#9c27b0)',color:'#fff',boxShadow:'0 4px 15px rgba(233,30,140,0.4)',transform:'translateY(-1px)'},
  
  // Product grid - beautiful cards
  grid:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(125px,1fr))',gap:10,padding:12,overflowY:'auto',flex:1,alignContent:'start'},
  card:{background:'linear-gradient(145deg,rgba(30,30,60,0.9),rgba(40,40,80,0.8))',border:'1px solid rgba(255,255,255,0.08)',borderRadius:16,padding:'14px 10px 10px',cursor:'pointer',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:4,boxShadow:'0 4px 15px rgba(0,0,0,0.3)',backdropFilter:'blur(5px)',transition:'all 0.15s'},
  cardVrac:{background:'linear-gradient(145deg,rgba(60,20,80,0.9),rgba(100,30,120,0.8))',border:'1px solid rgba(233,30,140,0.4)',boxShadow:'0 4px 15px rgba(233,30,140,0.2)'},
  cardImg:{width:58,height:58,objectFit:'cover',borderRadius:12,marginBottom:3,boxShadow:'0 4px 12px rgba(0,0,0,0.4)'},
  cardName:{fontSize:11,fontWeight:700,color:'#e0e0ff',lineHeight:1.2,maxHeight:30,overflow:'hidden'},
  cardPrice:{fontSize:14,fontWeight:900,color:'#ff6b9d',marginTop:3,letterSpacing:'-0.3px'},
  
  // Right panel - cart
  right:{width:310,background:'rgba(10,10,30,0.95)',borderLeft:'1px solid rgba(255,255,255,0.06)',display:'flex',flexDirection:'column',backdropFilter:'blur(20px)'},
  cartHead:{padding:'12px 14px',fontWeight:900,fontSize:16,background:'linear-gradient(135deg,rgba(233,30,140,0.15),rgba(156,39,176,0.1))',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0,letterSpacing:'-0.3px'},
  
  // Loyalty card in cart
  loyCard:{background:'linear-gradient(135deg,rgba(233,30,140,0.1),rgba(156,39,176,0.08))',border:'1px solid rgba(233,30,140,0.25)',borderRadius:12,padding:'8px 12px',marginTop:8,boxShadow:'0 2px 10px rgba(233,30,140,0.1)'},
  btnX:{background:'transparent',border:'none',color:'#666',cursor:'pointer',fontSize:16,fontWeight:700,lineHeight:1},
  cogBtn:{flex:1,padding:'6px 8px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)',color:'#888',fontWeight:700,fontSize:11,cursor:'pointer',transition:'all 0.2s'},
  cogOn:{background:'linear-gradient(135deg,#e91e8c,#9c27b0)',color:'#fff',border:'none',boxShadow:'0 2px 8px rgba(233,30,140,0.3)'},
  cogOff:{background:'rgba(255,255,255,0.04)',color:'#666'},
  emailBtn:{width:'100%',marginTop:6,padding:'5px',borderRadius:8,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)',color:'#888',fontWeight:700,fontSize:11,cursor:'pointer',transition:'background 0.2s'},
  
  // Cart items
  items:{flex:1,overflowY:'auto',padding:'8px 10px',display:'flex',flexDirection:'column',gap:6},
  empty:{color:'#3a3a5a',textAlign:'center',padding:30,fontSize:14},
  item:{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:'8px 10px',display:'flex',flexDirection:'column',gap:4,border:'1px solid rgba(255,255,255,0.05)'},
  iName:{fontSize:12,fontWeight:700,color:'#c0c0e0'},
  iRow:{display:'flex',alignItems:'center',gap:6},
  qBtn:{width:26,height:26,borderRadius:8,border:'none',background:'linear-gradient(135deg,rgba(233,30,140,0.3),rgba(156,39,176,0.2))',color:'#e91e8c',fontWeight:900,cursor:'pointer',fontSize:16,boxShadow:'0 1px 4px rgba(233,30,140,0.2)'},
  qNum:{fontSize:14,fontWeight:800,minWidth:20,textAlign:'center',color:'#fff'},
  xBtn:{width:22,height:22,borderRadius:6,border:'none',background:'rgba(255,50,50,0.15)',color:'#ff6b6b',fontWeight:700,cursor:'pointer',fontSize:11},
  
  // Cart footer
  footer:{padding:12,borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',flexDirection:'column',gap:7,flexShrink:0,background:'rgba(0,0,0,0.2)'},
  discRow:{display:'flex',justifyContent:'space-between',fontSize:12,color:'#ff6b9d',fontWeight:700,padding:'2px 0'},
  totalRow:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0'},
  totalAmt:{fontSize:28,fontWeight:900,color:'#fff',letterSpacing:'-1px',textShadow:'0 0 20px rgba(233,30,140,0.3)'},
  tvaRow:{display:'flex',justifyContent:'space-between',fontSize:10,color:'#444'},
  
  // Payment buttons - large and prominent
  payBtn:{flex:1,padding:'13px 5px',borderRadius:14,border:'none',fontWeight:900,fontSize:15,cursor:'pointer',letterSpacing:'-0.3px',boxShadow:'0 4px 15px rgba(0,0,0,0.3)',transition:'transform 0.1s'},
  payCard:{background:'linear-gradient(135deg,#e91e8c,#c2185b)',color:'#fff',boxShadow:'0 4px 20px rgba(233,30,140,0.5)'},
  payCash:{background:'linear-gradient(135deg,#00c853,#2e7d32)',color:'#fff',boxShadow:'0 4px 20px rgba(0,200,83,0.4)'},
  remiseBtn:{flex:1,padding:'8px',borderRadius:10,border:'1px solid rgba(255,165,0,0.3)',background:'linear-gradient(135deg,rgba(255,165,0,0.1),rgba(255,120,0,0.08))',color:'#ffb74d',fontWeight:700,fontSize:12,cursor:'pointer'},
  clearRemise:{padding:'8px 10px',borderRadius:10,border:'1px solid rgba(255,50,50,0.3)',background:'rgba(255,50,50,0.08)',color:'#ff6b6b',fontWeight:700,fontSize:12,cursor:'pointer'},
  clearBtn:{padding:8,borderRadius:10,border:'1px solid rgba(255,50,50,0.15)',background:'rgba(255,50,50,0.05)',color:'#ff4444',fontWeight:700,fontSize:12,cursor:'pointer'},
  
  // Settings panel
  settingsOverlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)'},
  settingsPanel:{width:'95%',maxWidth:780,background:'linear-gradient(145deg,#0f0f25,#1a1a35)',display:'flex',flexDirection:'column',height:'92vh',borderRadius:20,overflow:'hidden',border:'1px solid rgba(255,255,255,0.08)',boxShadow:'0 30px 80px rgba(0,0,0,0.8)'},
  settingsHead:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',background:'linear-gradient(135deg,#e91e8c,#9c27b0,#ff6b35)',flexShrink:0},
  tabBtn:{padding:'7px 16px',borderRadius:10,border:'2px solid rgba(255,255,255,0.25)',background:'rgba(255,255,255,0.08)',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',backdropFilter:'blur(5px)',transition:'all 0.2s'},
  tabActive:{background:'rgba(255,255,255,0.95)',color:'#e91e8c',border:'2px solid transparent',boxShadow:'0 2px 10px rgba(0,0,0,0.3)'},
  settingsClose:{padding:'7px 14px',borderRadius:10,border:'none',background:'rgba(0,0,0,0.3)',color:'#fff',fontWeight:700,cursor:'pointer',fontSize:16},
  btnAdd:{padding:'7px 16px',borderRadius:10,border:'none',background:'rgba(255,255,255,0.95)',color:'#e91e8c',fontWeight:800,cursor:'pointer',fontSize:13,boxShadow:'0 2px 8px rgba(0,0,0,0.2)'},
  settingsSearch:{margin:'12px 16px 6px',padding:'10px 16px',borderRadius:12,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:13,outline:'none',flexShrink:0,transition:'border 0.2s'},
  settingsList:{flex:1,overflowY:'auto',padding:'4px 12px 12px'},
  sItem:{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:12,marginBottom:6,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.05)',transition:'background 0.2s'},
  sThumb:{width:44,height:44,objectFit:'cover',borderRadius:10,flexShrink:0,boxShadow:'0 2px 8px rgba(0,0,0,0.3)'},
  editBtn:{padding:'6px 10px',borderRadius:8,border:'none',background:'rgba(233,30,140,0.15)',color:'#ff6b9d',fontWeight:700,cursor:'pointer',fontSize:14,transition:'background 0.2s'},
  delBtn:{padding:'6px 9px',borderRadius:8,border:'none',background:'rgba(255,50,50,0.15)',color:'#ff6b6b',fontWeight:700,cursor:'pointer',fontSize:14},
  
  // Modals
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,backdropFilter:'blur(12px)'},
  modal:{background:'linear-gradient(145deg,#14142a,#1e1e3a)',borderRadius:20,padding:26,width:430,maxWidth:'95vw',boxShadow:'0 30px 80px rgba(0,0,0,0.9)',border:'1px solid rgba(255,255,255,0.08)'},
  mTitle:{fontSize:21,fontWeight:900,marginBottom:18,textAlign:'center',letterSpacing:'-0.5px'},
  mBtns:{display:'flex',gap:10},
  btnCancel:{flex:1,padding:12,borderRadius:12,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)',color:'#888',fontWeight:700,cursor:'pointer',fontSize:14,transition:'background 0.2s'},
  btnConfirm:{flex:1,padding:12,borderRadius:12,border:'none',background:'linear-gradient(135deg,#e91e8c,#9c27b0)',color:'#fff',fontWeight:800,cursor:'pointer',fontSize:14,boxShadow:'0 4px 15px rgba(233,30,140,0.4)',transition:'transform 0.1s'},
  eGrid:{display:'grid',gridTemplateColumns:'90px 1fr',gap:'12px 14px',marginBottom:18,alignItems:'start'},
  eLabel:{fontSize:13,color:'#888',fontWeight:700,textAlign:'right',paddingTop:9},
  eInput:{padding:'9px 14px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.06)',color:'#fff',fontSize:14,outline:'none',width:'100%',transition:'border 0.2s'},
  uploadBtn:{display:'inline-block',padding:'9px 16px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#e91e8c,#9c27b0)',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',textAlign:'center',boxShadow:'0 2px 10px rgba(233,30,140,0.3)'},
};
