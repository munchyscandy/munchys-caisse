import { useState, useEffect, useCallback, useRef } from "react";
import { products as BASE_PRODUCTS } from "./products";
const TVA = 0.06;
const CASHBACK_RATE = 0.05;
const VRAC_PRICE_PER_100G = 1.50;
const SUPABASE_URL = "https://swrpladhwaspibpoegwn.supabase.co";
const SUPABASE_KEY = "sb_publishable_1m5yOZvVzFfXQQYqoN8h_A_nd56vaPI";
const SB = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const fmt = (n) => parseFloat(n||0).toFixed(2).replace('.', ',') + '€';
const today = () => new Date().toISOString().split('T')[0];
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
// Brand colors RAL 6027 + RAL 4003
const C1 = '#D3518B';
const C2 = '#78B7A0';
const C1d = '#a03568';
const C2d = '#4a8a72';
export default function App() {
  const [cart, setCart] = useState([]);
  const [activeCat, setActiveCat] = useState("TOUT");
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [modal, setModal] = useState(null);
  const [client, setClient] = useState(null);
  const [useCagnotte, setUseCagnotte] = useState(false);
  const [allClients, setAllClients] = useState([]);
  const [loySearch, setLoySearch] = useState("");
  const [loyResults, setLoyResults] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('percent');
  const [discountInput, setDiscountInput] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [receiptEmail, setReceiptEmail] = useState('');
  const [sendingReceiptEmail, setSendingReceiptEmail] = useState(false);
  const [vracG, setVracG] = useState('');
  const [emailClient, setEmailClient] = useState(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [montantDonne, setMontantDonne] = useState('');
  const [testVentes, setTestVentes] = useState([]);
  const [exportDateFrom, setExportDateFrom] = useState(new Date().toISOString().split('T')[0].slice(0,7)+'-01');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPeriodType, setExportPeriodType] = useState('custom'); // daily, monthly, quarterly, custom
  const [exportDetailLevel, setExportDetailLevel] = useState('global'); // global, detail, client
  const [exportFormat, setExportFormat] = useState('pdf'); // pdf, csv, both
  const [exportDateTo, setExportDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [pinInput, setPinInput] = useState('');
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const PIN_CODE = '1234';
  const [ventes, setVentes] = useState([]);
  const [journalDate, setJournalDate] = useState(new Date().toISOString().split('T')[0]);
  const [session, setSession] = useState(null);
  const [showOpenSession, setShowOpenSession] = useState(false);
  const [showCloseSession, setShowCloseSession] = useState(false);
  const [montantOuverture, setMontantOuverture] = useState('');
  const [montantFermeture, setMontantFermeture] = useState('');
  const [closingData, setClosingData] = useState({especes:0,carte:0,nb:0,loaded:false});
  const [noteEcart, setNoteEcart] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('produits');
  const [customProducts, setCustomProducts] = useState([]);
  const [settingsSearch, setSettingsSearch] = useState('');
  const [editProduct, setEditProduct] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showCartScanner, setShowCartScanner] = useState(false);
  const [scanMode, setScanMode] = useState('product'); // 'product' or 'cart'
  const allProductsRef = useRef([]);
  const scanInputRef = useRef(null);
  const searchRef = useRef(null);
  const scannerRef = useRef(null);
  const [scannerValue, setScannerValue] = useState('');
  const scanBufferRef = useRef('');
  const scanTimerRef = useRef(null);
  const scanModeRef = useRef('product');
  const settingsTabRef = useRef('produits');
  const showSettingsRef = useRef(false);
  const [boxes, setBoxes] = useState([]);
  const [editBox, setEditBox] = useState(null);
  const [boxSearch, setBoxSearch] = useState('');
  const [boxGenPDF, setBoxGenPDF] = useState(false);
  const [boxQuantite, setBoxQuantite] = useState(1);
  const [stockData, setStockData] = useState([]);
  const [editingStock, setEditingStock] = useState(null);
  const [stockSearch, setStockSearch] = useState('');
  const [stockScanned, setStockScanned] = useState(null); // produit trouvé par scan
  const [stockQty, setStockQty] = useState('');
  const [stockAlert, setStockAlert] = useState('5');
  useEffect(() => {
    loadCustomProducts(); loadClients(); loadBoxes(); loadCurrentSession();
    setTimeout(()=>searchRef.current?.focus(), 500);
    // Écouteur global douchette scanner
    let barcodeBuffer = '';
    let barcodeTimer = null;
    const handleGlobalKeydown = async (e) => {
      // Ignorer si on est dans un input/textarea (sauf la recherche)
      const tag = document.activeElement?.tagName;
      if(tag==='INPUT'||tag==='TEXTAREA') return;
      
      if(e.key==='Enter' && barcodeBuffer.length >= 6){
        const code = barcodeBuffer.trim();
        barcodeBuffer = '';
        clearTimeout(barcodeTimer);
        const found = allProductsRef.current.find(p=>p.barcode&&String(p.barcode).trim()===code);
        if(found && showSettingsRef.current && settingsTabRef.current==='stock'){
          // Mode stock : ouvrir directement la fiche stock du produit
          setStockScanned(found);
          setEditingStock(found);
          setStockQty('0');
          setStockAlert('5');
          document.dispatchEvent(new CustomEvent('scrollToStock', {detail:found.id}));
          return;
        }
        if(found){
          addToCart(found);
        } else {
          try {
            const r = await fetch('https://world.openfoodfacts.org/api/v0/product/'+code+'.json');
            const d = await r.json();
            if(d.status===1&&d.product){
              const p = d.product;
              const nom = p.product_name_fr||p.product_name||p.generic_name_fr||'';
              const marque = p.brands||'';
              if(nom && window.confirm('Trouvé: '+nom+(marque?' - '+marque:'')+'. Ajouter au catalogue ?')){
                // setEditProduct handled in main component
                window._pendingBarcode = {nom:nom+(marque?' — '+marque:''),barcode:code};
                document.dispatchEvent(new CustomEvent('addProductFromBarcode'));
              }
            } else if(settingsTabRef.current==='stock') {
              // Mode stock - juste signaler produit inconnu
              alert('Code '+code+' non trouvé. Associez-le dans Produits d\'abord.');
            } else {
              alert('Code '+code+' non reconnu. Associez-le dans Produits.');
            }
          } catch(err){}
        }
      } else if(e.key!=='Enter' && /^[0-9a-zA-Z]$/.test(e.key)){
        barcodeBuffer += e.key;
        clearTimeout(barcodeTimer);
        barcodeTimer = setTimeout(()=>{ barcodeBuffer=''; }, 100);
      }
    };
    document.addEventListener('keydown', handleGlobalKeydown);
    return () => document.removeEventListener('keydown', handleGlobalKeydown);
    // Précharger html5-qrcode
    if (!document.getElementById('html5qrcode-script')) {
      const s = document.createElement('script');
      s.id = 'html5qrcode-script';
      s.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      document.head.appendChild(s);
    }
  }, []);
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
  const loadVentes = async (date, sess) => {
    try {
      const d = date || new Date().toISOString().split('T')[0];
      const activeSession = sess !== undefined ? sess : session;
      // Si caisse ouverte → seulement ventes de la session en cours
      let url;
      if (activeSession) {
        url = `${SUPABASE_URL}/rest/v1/ventes?date_heure=gte.${encodeURIComponent(activeSession.date_ouverture)}&order=date_heure.desc&select=*`;
      } else {
        url = `${SUPABASE_URL}/rest/v1/ventes?date_heure=gte.${d}T00:00:00&date_heure=lte.${d}T23:59:59&order=date_heure.desc&select=*`;
      }
      const r = await fetch(url, { headers: SB });
      const data = await r.json();
      if (Array.isArray(data)) setVentes(data);
    } catch(e) {}
  };
  const loadCurrentSession = async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/sessions_caisse?statut=eq.ouvert&order=created_at.desc&limit=1&select=*`, { headers: SB });
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) setSession(data[0]);
      else setSession(null);
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
  const loadClosingData = async (sess) => {
    setClosingData({especes:0,carte:0,nb:0,loaded:false});
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/ventes?date_heure=gte.${(sess||session).date_ouverture}&annulee=eq.false&select=total,paiement`, {headers:SB});
      const d = await r.json();
      if (Array.isArray(d)) {
        const esp = d.filter(v=>v.paiement==="espèces").reduce((s,v)=>s+parseFloat(v.total||0),0);
        const car = d.filter(v=>v.paiement==="carte").reduce((s,v)=>s+parseFloat(v.total||0),0);
        setClosingData({especes:esp,carte:car,nb:d.length,loaded:true});
      }
    } catch(e) { setClosingData({especes:0,carte:0,nb:0,loaded:true}); }
  };
  const upsertStock = async (nom, qty, seuil) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/stock?product_nom=eq.${encodeURIComponent(nom)}&select=id`, { headers: SB });
    const d = await r.json();
    if (d && d.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/stock?id=eq.${d[0].id}`, {
        method:'PATCH', headers:{...SB,Prefer:"return=minimal"},
        body: JSON.stringify({quantite:qty,seuil_alerte:seuil,updated_at:new Date().toISOString()})
      });
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/stock`, {
        method:'POST', headers:{...SB,Prefer:"return=minimal"},
        body: JSON.stringify({product_nom:nom,quantite:qty,seuil_alerte:seuil})
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
        await fetch(`${SUPABASE_URL}/rest/v1/stock?id=eq.${d[0].id}`, {
          method:'PATCH', headers:{...SB,Prefer:"return=minimal"},
          body: JSON.stringify({quantite:Math.max(0,(d[0].quantite||0)-total),updated_at:new Date().toISOString()})
        });
      }
    }
  };
  // Remettre le stock quand on annule des boxes
  const restoreStock = async (produits, qty_boxes) => {
    for (const p of produits) {
      const total = p.qty * qty_boxes;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/stock?product_nom=eq.${encodeURIComponent(p.nom)}&select=id,quantite`, { headers: SB });
      const d = await r.json();
      if (d && d.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/stock?id=eq.${d[0].id}`, {
          method:'PATCH', headers:{...SB,Prefer:"return=minimal"},
          body: JSON.stringify({quantite:(d[0].quantite||0)+total,updated_at:new Date().toISOString()})
        });
      }
    }
  };
  // Export PDF comptable des boxes
  const exportBoxesPDF = async () => {
    const debut = prompt('Date de début (YYYY-MM-DD) :');
    if(!debut) return;
    const fin = prompt('Date de fin (YYYY-MM-DD) :');
    if(!fin) return;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/box_contents?date_vente=gte.${debut}&date_vente=lte.${fin}&order=date_vente&select=*`, { headers: SB });
    const data = await r.json();
    if(!Array.isArray(data)||!data.length){ alert('Aucune box sur cette période'); return; }
    const totalCA = data.reduce((s,b)=>s+parseFloat(b.box_prix||0)*parseInt(b.quantite||1),0);
    const totalBoxes = data.reduce((s,b)=>s+parseInt(b.quantite||1),0);
    const w = window.open('about:blank','_blank');
    w.document.write(`<html><head><title>Rapport Box ${debut} au ${fin}</title>
    <style>body{font-family:sans-serif;padding:30px;max-width:800px;margin:auto;color:#333}
    h1{color:#D3518B}table{width:100%;border-collapse:collapse;margin:12px 0}
    th{background:#D3518B;color:#fff;padding:10px;text-align:left}td{padding:8px;border-bottom:1px solid #eee}
    .total{background:#78B7A0;color:#fff;font-weight:bold}.right{text-align:right}</style></head>
    <body>
    <h1>🍬 Munchy's Candy — Rapport Box Mystère</h1>
    <p><b>Période :</b> ${debut} au ${fin}</p>
    <p><b>TVA BE 0750.497.413</b> · Mouscron</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0">
      <div style="background:#f5f5f5;padding:14px;border-radius:8px;text-align:center">
        <b style="display:block;font-size:22px;color:#D3518B">${totalBoxes}</b><small>Boxes vendues</small>
      </div>
      <div style="background:#f5f5f5;padding:14px;border-radius:8px;text-align:center">
        <b style="display:block;font-size:22px;color:#D3518B">${totalCA.toFixed(2)}€</b><small>CA Total</small>
      </div>
    </div>
    <table>
      <tr><th>Date</th><th>Nom</th><th>Prix unit.</th><th>Qté</th><th class="right">Total</th><th>Contenu</th></tr>
      ${data.map(b=>{
        const prods=typeof b.produits==='string'?JSON.parse(b.produits):b.produits;
        const total=(parseFloat(b.box_prix||0)*parseInt(b.quantite||1)).toFixed(2);
        return `<tr>
          <td>${b.date_vente}</td>
          <td>${b.box_nom}</td>
          <td>${parseFloat(b.box_prix||0).toFixed(2)}€</td>
          <td>${b.quantite||1}</td>
          <td class="right"><b>${total}€</b></td>
          <td style="font-size:11px">${prods.map(p=>p.nom+' x'+p.qty).join(', ')}</td>
        </tr>`;
      }).join('')}
      <tr class="total"><td colspan="4"><b>TOTAL</b></td><td class="right">${totalCA.toFixed(2)}€</td><td></td></tr>
    </table>
    <p style="color:#888;font-size:11px;margin-top:20px">Généré le ${new Date().toLocaleString('fr-BE')}</p>
    <script>window.print();</script>
    </body></html>`);
    w.document.close();
  };
  const addStock = async (nom, qty_add) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/stock?product_nom=eq.${encodeURIComponent(nom)}&select=id,quantite`, { headers: SB });
    const d = await r.json();
    if (d && d.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/stock?id=eq.${d[0].id}`, {
        method:'PATCH', headers:{...SB,Prefer:"return=minimal"},
        body: JSON.stringify({quantite:(d[0].quantite||0)+qty_add,updated_at:new Date().toISOString()})
      });
      loadStock();
    }
  };
  const allProducts = (() => {
    const hidden = new Set(customProducts.filter(p=>!p.actif&&p.base_product_id!=null).map(p=>p.base_product_id));
    const overridden = new Set(customProducts.filter(p=>p.actif&&p.base_product_id!=null).map(p=>p.base_product_id));
    const base = BASE_PRODUCTS.filter(p=>!overridden.has(p.id)&&!hidden.has(p.id));
    const custom = customProducts.filter(p=>p.actif).map(p=>({
      id:`c_${p.id}`,nom:p.nom,categorie:p.categorie||"Autres",
      prix:parseFloat(p.prix)||0,vrac:p.vrac||false,
      barcode:p.barcode||"",photo_url:p.photo_url||"",
      custom_id:p.id,base_product_id:p.base_product_id
    }));
    return [...custom,...base];
  })();
  allProductsRef.current = allProducts;
  scanModeRef.current = scanMode;
  settingsTabRef.current = settingsTab;
  showSettingsRef.current = showSettings;
  // Handle barcode product add from global listener
  useEffect(()=>{
    const handler = () => {
      if(window._pendingBarcode){
        const {nom, barcode} = window._pendingBarcode;
        window._pendingBarcode = null;
        setEditProduct({nom,categorie:'Autres',prix:'',vrac:false,barcode,photo_url:''});
        setIsNew(true);
        setShowSettings(true);
        setSettingsTab('produits');
      }
    };
    document.addEventListener('addProductFromBarcode', handler);
    return () => document.removeEventListener('addProductFromBarcode', handler);
  }, []);
  useEffect(()=>{
    const handler = (e) => {
      const el = document.getElementById('stock-item-'+e.detail);
      if(el) el.scrollIntoView({behavior:'smooth',block:'center'});
    };
    document.addEventListener('scrollToStock', handler);
    return () => document.removeEventListener('scrollToStock', handler);
  }, []);
  // Refocus scanner input when not in modal/settings
  const refocusScanner = () => {
    if(!showSettings && !modal && scanInputRef.current) {
      searchRef.current?.focus();
    }
  };
  const filtered = allProducts.filter(p=>{
    const cat = activeCat==="TOUT"||p.categorie===activeCat;
    const s = !search||p.nom.toLowerCase().includes(search.toLowerCase());
    return cat&&s;
  });
  const cartTotal = cart.reduce((s,i)=>s+i.prix*i.qty,0);
  const cagnotte = client?(client.cagnotte||0):0;
  const cagnotteUsed = (client&&useCagnotte)?Math.min(cagnotte,cartTotal):0;
  const discountAmt = discountType==='percent'
    ?(cartTotal-cagnotteUsed)*(discount/100)
    :Math.min(discount,cartTotal-cagnotteUsed);
  const finalTotal = Math.max(0,cartTotal-cagnotteUsed-discountAmt);
  const tva = finalTotal*TVA/(1+TVA);
  const cashback = finalTotal*CASHBACK_RATE;
  const addToCart = useCallback((p,px=null)=>{
    const prix = px!==null?px:p.prix;
    setCart(prev=>{
      if(!p.vrac){
        const ex=prev.find(i=>i.id===p.id);
        if(ex) return prev.map(i=>i.id===p.id?{...i,qty:i.qty+1}:i);
      }
      return [...prev,{...p,prix,qty:1,cartId:Date.now()}];
    });
  },[]);
  const removeItem = (cid) => setCart(p=>p.filter(i=>i.cartId!==cid));
  const updateQty = (cid,d) => setCart(p=>
    p.map(i=>i.cartId!==cid?i:i.qty+d<=0?null:{...i,qty:i.qty+d}).filter(Boolean)
  );
  const handleBarcode = (e) => {
    if(e.key==='Enter'&&barcode.trim()){
      const f=allProducts.find(p=>p.barcode===barcode.trim());
      if(f){f.vrac?setModal('vrac'):addToCart(f);}
      else alert("Produit non trouvé: "+barcode);
      setBarcode('');
    }
  };
  const handleVrac = () => {
    const g=parseFloat(vracG);
    if(!g||g<=0) return;
    const p=allProducts.find(p=>p.vrac)||{id:9999,nom:"Bonbons vrac",categorie:"Bonbons",vrac:true};
    addToCart({...p,nom:`Bonbons vrac (${g}g)`,cartId:Date.now()},g/100*VRAC_PRICE_PER_100G);
    setVracG('');setModal(null);
  };
  const searchClient = (q) => {
    if(!q.trim()){setLoyResults([]);return;}
    const ql=q.toLowerCase();
    setLoyResults(allClients.filter(c=>
      (c.name&&c.name.toLowerCase().includes(ql))||
      (c.phone&&c.phone.toLowerCase().includes(ql))||
      (c.email&&c.email.toLowerCase().includes(ql))
    ));
  };
  const applyDiscount = () => {
    const v=parseFloat(discountInput.replace(',','.'));
    if(!v||v<=0){alert("Valeur invalide");return;}
    setDiscount(v);setModal(null);
  };
  const handlePayment = async (method) => {
    if(client&&!testMode){
      const newCag=cagnotte-cagnotteUsed+cashback;
      await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${client.id}`,{
        method:'PATCH',headers:{...SB,Prefer:"return=minimal"},
        body:JSON.stringify({cagnotte:Math.max(0,newCag)})
      });
    }
    if(!testMode){
      await fetch(`${SUPABASE_URL}/rest/v1/ventes`,{
        method:'POST',headers:{...SB,Prefer:"return=minimal"},
        body:JSON.stringify({
          articles:JSON.stringify(cart),total:finalTotal,paiement:method,
          remise:discountAmt,cagnotte_used:cagnotteUsed,
          client_nom:client?client.name:null,client_id:client?client.id:null
        })
      });
    } else {
      setTestVentes(prev=>[{
        id:Date.now(),date_heure:new Date().toISOString(),
        articles:JSON.stringify(cart),total:finalTotal,paiement:method,
        remise:discountAmt,cagnotte_used:cagnotteUsed,
        client_nom:client?client.name:null,annulee:false,note_annulation:null
      },...prev]);
    }
    setReceipt({cart:[...cart],cartTotal,cagnotteUsed,discountAmt,finalTotal,tva,cashback,method,client,date:new Date()});
    setModal('receipt');
  };
  const newSale = () => {
    setCart([]);setClient(null);setUseCagnotte(false);setDiscount(0);
    setDiscountInput('');setModal(null);setReceipt(null);setSearch('');
  };
  const startBarcodeScanner = () => setShowBarcodeScanner(true);
  const stopBarcodeScanner = () => {
    setShowBarcodeScanner(false);
    if(window._barcodeStream){window._barcodeStream.getTracks().forEach(t=>t.stop());window._barcodeStream=null;}
    clearInterval(window._barcodeInterval);
  };
  const uploadPhoto = async (file) => {
    setUploading(true);
    try {
      const fn=`${Date.now()}.${file.name.split('.').pop()}`;
      const r=await fetch(`${SUPABASE_URL}/storage/v1/object/product-photos/${fn}`,{
        method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,"Content-Type":file.type},body:file
      });
      if(r.ok) setEditProduct(p=>({...p,photo_url:`${SUPABASE_URL}/storage/v1/object/public/product-photos/${fn}`}));
      else alert("Erreur upload");
    } catch(e){alert("Erreur: "+e.message);}
    setUploading(false);
  };
  const openEdit = (p,nouveau=false) => {
    if(nouveau){setEditProduct({nom:'',categorie:'Bonbons',prix:'',vrac:false,barcode:'',photo_url:''});setIsNew(true);}
    else {
      setEditProduct({
        nom:p.nom,categorie:p.categorie,prix:p.prix,vrac:p.vrac,
        barcode:p.barcode,photo_url:p.photo_url||'',
        base_product_id:!String(p.id).startsWith('c_')?p.id:(p.base_product_id||null),
        custom_id:p.custom_id||null
      });
      setIsNew(false);
    }
  };
  const saveProduct = async () => {
    if(!editProduct.nom||editProduct.prix===''){alert("Nom et prix requis");return;}
    setSaving(true);
    const payload={
      nom:editProduct.nom,categorie:editProduct.categorie,
      prix:parseFloat(String(editProduct.prix).replace(',','.')),
      vrac:editProduct.vrac,barcode:editProduct.barcode||null,
      photo_url:editProduct.photo_url||null,actif:true,
      base_product_id:editProduct.base_product_id!=null?editProduct.base_product_id:null
    };
    try {
      if(editProduct.custom_id){
        await fetch(`${SUPABASE_URL}/rest/v1/products_custom?id=eq.${editProduct.custom_id}`,{
          method:'PATCH',headers:{...SB,Prefer:"return=minimal"},body:JSON.stringify(payload)
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/products_custom`,{
          method:'POST',headers:{...SB,Prefer:"return=minimal"},body:JSON.stringify(payload)
        });
      }
      await loadCustomProducts();setEditProduct(null);
    } catch(e){alert("Erreur: "+e.message);}
    setSaving(false);
  };
  const deleteProduct = async (cid) => {
    if(!confirm("Supprimer définitivement ?")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/products_custom?id=eq.${cid}`,{
      method:'PATCH',headers:{...SB,Prefer:"return=minimal"},body:JSON.stringify({actif:false})
    });
    loadCustomProducts();
  };
  const hideBaseProduct = async (p) => {
    if(!confirm(`Supprimer "${p.nom}" du catalogue ?`)) return;
    await fetch(`${SUPABASE_URL}/rest/v1/products_custom`,{
      method:'POST',headers:{...SB,Prefer:"return=minimal"},
      body:JSON.stringify({nom:p.nom,categorie:p.categorie,prix:p.prix,vrac:p.vrac,barcode:p.barcode||null,photo_url:p.photo_url||null,actif:false,base_product_id:typeof p.id==='number'?p.id:null})
    });
    loadCustomProducts();
  };
  const newBox = () => setEditBox({nom:'Box Mystère 10€',prix:10,date:today(),produits:[],notes:''});
  const addToBox = (p) => setEditBox(b=>{
    const ex=b.produits.find(i=>i.id===p.id);
    if(ex) return {...b,produits:b.produits.map(i=>i.id===p.id?{...i,qty:i.qty+1}:i)};
    return {...b,produits:[...b.produits,{id:p.id,nom:p.nom,prix:p.prix,qty:1}]};
  });
  const removeFromBox = (id) => setEditBox(b=>({...b,produits:b.produits.filter(i=>i.id!==id)}));
  const saveBox = async () => {
    if(!editBox.produits.length){alert("Ajoutez au moins un produit");return;}
    const qty=boxQuantite||1;
    await fetch(`${SUPABASE_URL}/rest/v1/box_contents`,{
      method:'POST',headers:{...SB,Prefer:"return=minimal"},
      body:JSON.stringify({box_nom:editBox.nom,box_prix:editBox.prix,date_vente:editBox.date,
        produits:JSON.stringify(editBox.produits),notes:(editBox.notes||'')+(qty>1?` [${qty} boxes]`:''),quantite:qty})
    });
    await deductStock(editBox.produits,qty);
    await loadBoxes();await loadStock();
    setEditBox(null);setBoxQuantite(1);
    alert(`✅ ${qty} box(es) enregistrée(s) — stock mis à jour !`);
  };
  const deleteBox = async (id) => {
    if(!confirm("Supprimer cette box ?")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/box_contents?id=eq.${id}`,{method:'DELETE',headers:SB});
    loadBoxes();
  };
  const printBox = (box) => {
    const produits=typeof box.produits==='string'?JSON.parse(box.produits):box.produits;
    const total=produits.reduce((s,p)=>s+p.prix*p.qty,0);
    const w=window.open('','_blank');
    w.document.write(`<html><head><title>Box</title><style>body{font-family:monospace;padding:20px;max-width:400px;margin:auto}h2{color:#D3518B}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px}</style></head>
    <body><h2>🍬 MUNCHY'S CANDY</h2><p><b>${box.box_nom}</b> — ${box.date_vente}</p><p>TVA BE 0750.497.413</p><hr>
    <table><tr><th>Produit</th><th>Qté</th><th>Prix</th></tr>
    ${produits.map(p=>`<tr><td>${p.nom}</td><td>${p.qty}</td><td>${(p.prix*p.qty).toFixed(2)}€</td></tr>`).join('')}
    </table><hr><p><b>Contenu: ${total.toFixed(2)}€ / Vente: ${box.box_prix}€</b></p>
    ${box.notes?`<p>📝 ${box.notes}</p>`:''}
    <p style="color:#888;font-size:11px">Généré le ${new Date().toLocaleString('fr-BE')}</p>
    <script>window.print();window.close();</script></body></html>`);
  };
  const tryUnlock = () => {
    if(pinInput===PIN_CODE){setPinUnlocked(true);setShowPinModal(false);setShowSettings(true);setPinInput('');}
    else{alert('Code PIN incorrect');setPinInput('');}
  };
  const ouvrirSession = async () => {
    const m=parseFloat(String(montantOuverture).replace(',','.'));
    if(isNaN(m)){alert("Entrez un montant");return;}
    await fetch(`${SUPABASE_URL}/rest/v1/sessions_caisse`,{
      method:'POST',headers:{...SB,Prefer:"return=minimal"},
      body:JSON.stringify({montant_ouverture:m,statut:'ouvert'})
    });
    await loadCurrentSession();
    setShowOpenSession(false);setMontantOuverture('');
  };
  const fermerSession = async () => {
    const mf=parseFloat(String(montantFermeture).replace(',','.'));
    if(montantFermeture===''||isNaN(mf)){alert("Entrez le montant compté en caisse !");return;}
    let especes=closingData.especes;let carte=closingData.carte;
    if(!closingData.loaded){
      try{
        const r=await fetch(`${SUPABASE_URL}/rest/v1/ventes?date_heure=gte.${session.date_ouverture}&annulee=eq.false&select=total,paiement`,{headers:SB});
        const data=await r.json();
        if(Array.isArray(data)){
          especes=data.filter(v=>v.paiement==="espèces").reduce((s,v)=>s+parseFloat(v.total||0),0);
          carte=data.filter(v=>v.paiement==="carte").reduce((s,v)=>s+parseFloat(v.total||0),0);
        }
      }catch(e){}
    }
    const ouverture=parseFloat(session.montant_ouverture||0);
    const attendu=parseFloat((ouverture+especes).toFixed(2));
    const ecart=parseFloat((mf-attendu).toFixed(2));
    if(Math.abs(ecart)>0.01&&!noteEcart.trim()){
      alert(
        "❌ FERMETURE REFUSÉE — Écart détecté !\n\n"+
        "Fond d'ouverture : "+ouverture.toFixed(2)+"€\n"+
        "Ventes espèces   : +"+especes.toFixed(2)+"€\n"+
        "─────────────────────────\n"+
        "Montant attendu  : "+attendu.toFixed(2)+"€\n"+
        "Montant compté   : "+mf.toFixed(2)+"€\n"+
        "Écart            : "+(ecart>0?"+":"")+ecart.toFixed(2)+"€\n\n"+
        "📝 Remplissez la note pour justifier et réessayez."
      );
      return;
    }
    await fetch(`${SUPABASE_URL}/rest/v1/sessions_caisse?id=eq.${session.id}`,{
      method:"PATCH",headers:{...SB,Prefer:"return=minimal"},
      body:JSON.stringify({date_fermeture:new Date().toISOString(),montant_fermeture:mf,
        ventes_especes:especes,ventes_carte:carte,ecart,note_ecart:noteEcart||null,
        statut:Math.abs(ecart)>0.01?"ecart_justifie":"ferme"})
    });
    await envoyerRecapFermeture(especes,carte,ouverture,mf,ecart,noteEcart);
    setSession(null);setShowCloseSession(false);setMontantFermeture("");setNoteEcart("");
    alert(Math.abs(ecart)>0.01
      ?"⚠️ Caisse fermée avec écart justifié\nÉcart: "+(ecart>0?"+":"")+ecart.toFixed(2)+"€\nRécap envoyé par email !"
      :"✅ Caisse fermée — comptes JUSTES !\nEspèces: "+especes.toFixed(2)+"€ | Carte: "+carte.toFixed(2)+"€\nRécap envoyé par email !");
  };
  const envoyerRecapFermeture = async (especes,carte,ouverture,mf,ecart,note) => {
    const date=new Date().toLocaleDateString('fr-BE',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    const html=`<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px">
      <h2 style="color:#D3518B">🍬 Munchy's Candy — Fermeture de caisse</h2><p style="color:#666">${date}</p><hr>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr style="background:#f5f5f5"><th style="padding:10px;text-align:left">Détail</th><th style="padding:10px;text-align:right">Montant</th></tr>
        <tr><td style="padding:8px">💶 Fond d'ouverture</td><td style="padding:8px;text-align:right"><b>${ouverture.toFixed(2)}€</b></td></tr>
        <tr><td style="padding:8px">💵 Ventes espèces</td><td style="padding:8px;text-align:right;color:#78B7A0"><b>+${especes.toFixed(2)}€</b></td></tr>
        <tr><td style="padding:8px">💳 Ventes carte</td><td style="padding:8px;text-align:right;color:#D3518B"><b>+${carte.toFixed(2)}€</b></td></tr>
        <tr style="background:#f5f5f5"><td style="padding:8px"><b>Total ventes</b></td><td style="padding:8px;text-align:right"><b>${(especes+carte).toFixed(2)}€</b></td></tr>
        <tr><td style="padding:8px">Montant attendu</td><td style="padding:8px;text-align:right">${(ouverture+especes).toFixed(2)}€</td></tr>
        <tr><td style="padding:8px">Montant compté</td><td style="padding:8px;text-align:right">${mf.toFixed(2)}€</td></tr>
        <tr style="background:${Math.abs(ecart)>0.01?'#fff3e0':'#e8f5e9'}">
          <td style="padding:8px"><b>Écart</b></td>
          <td style="padding:8px;text-align:right;color:${Math.abs(ecart)>0.01?'#ff9800':'#4caf50'}"><b>${ecart>0?'+':''}${ecart.toFixed(2)}€</b></td>
        </tr>
      </table>
      ${note?`<p style="background:#fff3e0;padding:12px;border-radius:8px;border-left:4px solid #ff9800"><b>📝 Note:</b> ${note}</p>`:''}
      <hr><p style="color:#888;font-size:12px">Munchy's Candy · Mouscron · TVA BE 0750.497.413</p></div>`;
    try {
      const r = await fetch("https://swrpladhwaspibpoegwn.supabase.co/functions/v1/smooth-action",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtva3N6ZmJya3hscmZoZXV6dXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MDQ5MjcsImV4cCI6MjA5Mzk4MDkyN30.ft0llFp29j9kNg4LgSvvQ_nJd7GkfAcATY2TwrTTQ_w"
        },
        body:JSON.stringify({
          to:"contact.kalice@gmail.com",
          subject:`🍬 Fermeture caisse Munchy's — ${date}`,
          html
        })
      });
      const result = await r.json();
      if(result.id) {
        alert("✅ Email envoyé ! ID: "+result.id);
      } else {
        alert("❌ Resend erreur: "+JSON.stringify(result));
      }
    }catch(e){
      alert("❌ Erreur: "+e.message);
    }
  };
  const getExportDates = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    if(exportPeriodType==='daily'){
      const d = today.toISOString().split('T')[0];
      return {from:d, to:d, label:'Journalier - '+today.toLocaleDateString('fr-BE')};
    } else if(exportPeriodType==='monthly'){
      const from = new Date(y,m,1).toISOString().split('T')[0];
      const to = new Date(y,m+1,0).toISOString().split('T')[0];
      return {from,to,label:'Mensuel - '+today.toLocaleDateString('fr-BE',{month:'long',year:'numeric'})};
    } else if(exportPeriodType==='quarterly'){
      const q = Math.floor(m/3);
      const from = new Date(y,q*3,1).toISOString().split('T')[0];
      const to = new Date(y,q*3+3,0).toISOString().split('T')[0];
      return {from,to,label:`T${q+1} ${y}`};
    } else {
      return {from:exportDateFrom, to:exportDateTo, label:`Du ${exportDateFrom} au ${exportDateTo}`};
    }
  };
  const runExport = async () => {
    const {from, to, label} = getExportDates();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/ventes?date_heure=gte.${from}T00:00:00&date_heure=lte.${to}T23:59:59&order=date_heure&select=*`, { headers: SB });
    const data = await r.json();
    if (!Array.isArray(data)) { alert("Erreur chargement"); return; }
    const ok = data.filter(v => !v.annulee);
    if(!ok.length){ alert('Aucune vente sur cette période'); return; }
    if(exportFormat==='pdf'||exportFormat==='both') await generateExportPDF(ok, label, from, to);
    if(exportFormat==='csv'||exportFormat==='both') await exportCSV(from, to);
    setShowExportModal(false);
  };
  const generateExportPDF = async (ok, label, from, to) => {
    const totalTTC = ok.reduce((s,v)=>s+parseFloat(v.total||0),0);
    const totalTVA = totalTTC * 0.06 / 1.06;
    const totalEsp = ok.filter(v=>v.paiement==='espèces').reduce((s,v)=>s+parseFloat(v.total||0),0);
    const totalCarte = ok.filter(v=>v.paiement==='carte').reduce((s,v)=>s+parseFloat(v.total||0),0);
    // Grouper par jour
    const parJour = {};
    ok.forEach(v=>{
      const j = v.date_heure.split('T')[0];
      if(!parJour[j]) parJour[j]={esp:0,carte:0,nb:0,ventes:[]};
      if(v.paiement==='espèces') parJour[j].esp+=parseFloat(v.total||0);
      else parJour[j].carte+=parseFloat(v.total||0);
      parJour[j].nb++;
      parJour[j].ventes.push(v);
    });
    // Grouper par client si besoin
    const parClient = {};
    if(exportDetailLevel==='client'){
      ok.forEach(v=>{
        const c = v.client_nom||'Anonyme';
        if(!parClient[c]) parClient[c]={total:0,nb:0};
        parClient[c].total+=parseFloat(v.total||0);
        parClient[c].nb++;
      });
    }
    const w = window.open('about:blank','_blank');
    w.document.write(`<html><head><title>Export ${label}</title>
    <style>
      body{font-family:sans-serif;padding:30px;max-width:850px;margin:auto;color:#333}
      h1{color:#D3518B}h2{color:#444;font-size:15px;margin-top:20px;border-bottom:2px solid #D3518B;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}
      th{background:#D3518B;color:#fff;padding:8px 10px;text-align:left}
      td{padding:7px 10px;border-bottom:1px solid #eee}tr:hover{background:#fafafa}
      .total-row{background:#78B7A0;color:#fff;font-weight:bold}
      .right{text-align:right}
      .recap{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
      .box{background:#f5f5f5;padding:12px;border-radius:8px;text-align:center}
      .box b{display:block;font-size:20px;color:#D3518B}
      .annulee{color:#ff5555;text-decoration:line-through;opacity:0.6}
    </style></head><body>
    <h1>🍬 Munchy's Candy — Export ${label}</h1>
    <p style="color:#888;font-size:12px">TVA BE 0750.497.413 · Mouscron · Généré le ${new Date().toLocaleString('fr-BE')}</p>
    <div class="recap">
      <div class="box"><b>${ok.length}</b><small>Transactions</small></div>
      <div class="box"><b>${totalTTC.toFixed(2)}€</b><small>CA TTC</small></div>
      <div class="box"><b style="color:#78B7A0">${totalEsp.toFixed(2)}€</b><small>💵 Espèces</small></div>
      <div class="box"><b>${totalCarte.toFixed(2)}€</b><small>💳 Carte</small></div>
    </div>
    <div class="recap">
      <div class="box"><b>${totalTVA.toFixed(2)}€</b><small>TVA 6%</small></div>
      <div class="box"><b>${(totalTTC-totalTVA).toFixed(2)}€</b><small>CA HT</small></div>
    </div>
    ${exportDetailLevel==='global' ? `
    <h2>Récapitulatif par jour</h2>
    <table>
      <tr><th>Date</th><th>Nb ventes</th><th class="right">Espèces</th><th class="right">Carte</th><th class="right">Total</th></tr>
      ${Object.entries(parJour).map(([j,d])=>`
        <tr>
          <td>${new Date(j+'T12:00:00').toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</td>
          <td>${d.nb}</td><td class="right">${d.esp.toFixed(2)}€</td>
          <td class="right">${d.carte.toFixed(2)}€</td>
          <td class="right"><b>${(d.esp+d.carte).toFixed(2)}€</b></td>
        </tr>`).join('')}
      <tr class="total-row"><td colspan="2">TOTAL</td><td class="right">${totalEsp.toFixed(2)}€</td><td class="right">${totalCarte.toFixed(2)}€</td><td class="right">${totalTTC.toFixed(2)}€</td></tr>
    </table>` : ''}
    ${exportDetailLevel==='detail' ? `
    <h2>Détail de toutes les ventes</h2>
    <table>
      <tr><th>Date/Heure</th><th>Articles</th><th>Client</th><th class="right">Remise</th><th class="right">Total</th><th>Paiement</th></tr>
      ${ok.map(v=>{
        const arts=typeof v.articles==='string'?JSON.parse(v.articles):v.articles;
        return `<tr>
          <td>${new Date(v.date_heure).toLocaleString('fr-BE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
          <td style="font-size:11px">${(arts||[]).map(a=>a.nom+' x'+a.qty).join(', ')}</td>
          <td>${v.client_nom||'—'}</td>
          <td class="right">${parseFloat(v.remise||0)>0?parseFloat(v.remise).toFixed(2)+'€':'—'}</td>
          <td class="right"><b>${parseFloat(v.total).toFixed(2)}€</b></td>
          <td>${v.paiement==='carte'?'💳':'💵'}</td>
        </tr>`;
      }).join('')}
      <tr class="total-row"><td colspan="4">TOTAL — ${ok.length} ventes</td><td class="right">${totalTTC.toFixed(2)}€</td><td></td></tr>
    </table>` : ''}
    ${exportDetailLevel==='client' ? `
    <h2>Récapitulatif par client</h2>
    <table>
      <tr><th>Client</th><th>Nb achats</th><th class="right">Total dépensé</th><th class="right">Moyenne/achat</th></tr>
      ${Object.entries(parClient).sort((a,b)=>b[1].total-a[1].total).map(([c,d])=>`
        <tr>
          <td>${c}</td><td>${d.nb}</td>
          <td class="right"><b>${d.total.toFixed(2)}€</b></td>
          <td class="right">${(d.total/d.nb).toFixed(2)}€</td>
        </tr>`).join('')}
      <tr class="total-row"><td>TOTAL</td><td>${ok.length}</td><td class="right">${totalTTC.toFixed(2)}€</td><td></td></tr>
    </table>` : ''}
    <p style="color:#888;font-size:10px;margin-top:30px">Munchy's Candy · Société Kalice TVA BE 0750.497.413 · Export comptable ${label}</p>
    <script>setTimeout(()=>window.print(),500);</script>
    </body></html>`);
    w.document.close();
  };
  const exportCSV = async (dateFrom, dateTo) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/ventes?date_heure=gte.${dateFrom}T00:00:00&date_heure=lte.${dateTo}T23:59:59&order=date_heure&select=*`, { headers: SB });
    const data = await r.json();
    if (!Array.isArray(data)) { alert("Erreur chargement"); return; }
    const ok = data.filter(v => !v.annulee);
    
    // En-têtes CSV
    const headers = ['Date','Heure','N° vente','Mode paiement','Total TTC','TVA 6%','HT','Remise','Cagnotte utilisée','Client','Articles'];
    const rows = ok.map(v => {
      const d = new Date(v.date_heure);
      const arts = typeof v.articles==='string' ? JSON.parse(v.articles) : v.articles;
      const tva = parseFloat(v.total||0) * 0.06 / 1.06;
      const ht = parseFloat(v.total||0) - tva;
      return [
        d.toLocaleDateString('fr-BE'),
        d.toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'}),
        v.id,
        v.paiement,
        parseFloat(v.total||0).toFixed(2).replace('.',','),
        tva.toFixed(2).replace('.',','),
        ht.toFixed(2).replace('.',','),
        parseFloat(v.remise||0).toFixed(2).replace('.',','),
        parseFloat(v.cagnotte_used||0).toFixed(2).replace('.',','),
        v.client_nom||'',
        '"'+(arts||[]).map(a=>a.nom+' x'+a.qty).join(' | ')+'"'
      ].join(';');
    });
    
    // Ligne totaux
    const totalTTC = ok.reduce((s,v)=>s+parseFloat(v.total||0),0);
    const totalTVA = totalTTC * 0.06 / 1.06;
    const totalEsp = ok.filter(v=>v.paiement==='espèces').reduce((s,v)=>s+parseFloat(v.total||0),0);
    const totalCarte = ok.filter(v=>v.paiement==='carte').reduce((s,v)=>s+parseFloat(v.total||0),0);
    
    rows.push('');
    rows.push(`TOTAL;;${ok.length} ventes;Espèces: ${totalEsp.toFixed(2).replace('.',',')}€ / Carte: ${totalCarte.toFixed(2).replace('.',',')}€;${totalTTC.toFixed(2).replace('.',',')};${totalTVA.toFixed(2).replace('.',',')};;;;;`);
    
    const csv = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `munchys-ventes-${dateFrom}-au-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const exportPeriode = async (dateFrom, dateTo) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/ventes?date_heure=gte.${dateFrom}T00:00:00&date_heure=lte.${dateTo}T23:59:59&order=date_heure&select=*`, { headers: SB });
    const data = await r.json();
    if (!Array.isArray(data)) { alert("Erreur chargement"); return; }
    const ok = data.filter(v => !v.annulee); // Pas d'annulations
    const esp = ok.filter(v=>v.paiement==='espèces').reduce((s,v)=>s+parseFloat(v.total||0),0);
    const car = ok.filter(v=>v.paiement==='carte').reduce((s,v)=>s+parseFloat(v.total||0),0);
    const tva = (esp+car)*0.06/1.06;
    const parJour = {};
    ok.forEach(v=>{
      const j = v.date_heure.split('T')[0];
      if(!parJour[j]) parJour[j]={esp:0,car:0,nb:0};
      if(v.paiement==='espèces') parJour[j].esp+=parseFloat(v.total||0);
      else parJour[j].car+=parseFloat(v.total||0);
      parJour[j].nb++;
    });
    const annulees = data.filter(v=>v.annulee);
    // Ouvrir dans nouvelle fenêtre (compatible Safari iPad)
    const w = window.open('about:blank','_blank');
    if (!w) { alert("Autorisez les popups pour exporter"); return; }
    w.document.write(`<html><head><title>Export ${dateFrom} au ${dateTo}</title>
    <style>
      body{font-family:sans-serif;padding:30px;max-width:800px;margin:auto;color:#333}
      h1{color:#D3518B}h2{color:#555;font-size:16px;margin-top:20px}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      th{background:#D3518B;color:#fff;padding:10px;text-align:left}
      td{padding:8px 10px;border-bottom:1px solid #eee}
      tr:hover{background:#f9f9f9}
      .right{text-align:right}
      .recap{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:16px 0}
      .box{background:#f5f5f5;padding:14px;border-radius:8px;text-align:center}
      .box b{display:block;font-size:22px;color:#D3518B}
      .box small{color:#888;font-size:12px}
      .total-row{background:#78B7A0;color:#fff;font-weight:bold}
    </style></head>
    <body>
      <h1>🍬 Munchy's Candy — Relevé des ventes</h1>
      <p><b>Période :</b> du ${new Date(dateFrom).toLocaleDateString('fr-BE')} au ${new Date(dateTo).toLocaleDateString('fr-BE')}</p>
      <p><b>TVA BE 0750.497.413</b> · Mouscron, Belgique</p>
      <hr>
      <div class="recap">
        <div class="box"><b>${(esp+car).toFixed(2)}€</b><small>CA TTC total</small></div>
        <div class="box"><b>${tva.toFixed(2)}€</b><small>dont TVA 6%</small></div>
        <div class="box"><b>${ok.length}</b><small>Transactions</small></div>
      </div>
      <div class="recap">
        <div class="box"><b style="color:#78B7A0">${esp.toFixed(2)}€</b><small>💵 Espèces</small></div>
        <div class="box"><b>${car.toFixed(2)}€</b><small>💳 Carte</small></div>
        <div class="box"><b style="color:#ff5555">${annulees.length}</b><small>⛔ Annulées (exclues)</small></div>
      </div>
      <h2>Détail par jour</h2>
      <table>
        <tr><th>Date</th><th>Nb ventes</th><th class="right">Espèces</th><th class="right">Carte</th><th class="right">Total jour</th></tr>
        ${Object.entries(parJour).map(([j,d])=>`
          <tr>
            <td>${new Date(j+'T12:00:00').toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</td>
            <td>${d.nb}</td>
            <td class="right">${d.esp.toFixed(2)}€</td>
            <td class="right">${d.car.toFixed(2)}€</td>
            <td class="right"><b>${(d.esp+d.car).toFixed(2)}€</b></td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td colspan="2"><b>TOTAL PÉRIODE</b></td>
          <td class="right">${esp.toFixed(2)}€</td>
          <td class="right">${car.toFixed(2)}€</td>
          <td class="right">${(esp+car).toFixed(2)}€</td>
        </tr>
      </table>
      <p style="color:#888;font-size:11px;margin-top:30px">
        Généré le ${new Date().toLocaleString('fr-BE')} · Export comptable Munchy's Candy<br>
        <i>Les ventes annulées (${annulees.length}) sont exclues de ce rapport.</i>
      </p>
    </body></html>`);
    w.document.close();
    setTimeout(()=>{ try{ w.print(); }catch(e){} }, 800);
  };
  const exportMensuel = async (mois) => {
    const [annee,m]=mois.split('-');
    const r=await fetch(`${SUPABASE_URL}/rest/v1/ventes?date_heure=gte.${mois}-01T00:00:00&date_heure=lte.${mois}-31T23:59:59&order=date_heure&select=*`,{headers:SB});
    const data=await r.json();
    if(!Array.isArray(data)){alert("Erreur chargement");return;}
    const ok=data.filter(v=>!v.annulee);
    const esp=ok.filter(v=>v.paiement==='espèces').reduce((s,v)=>s+parseFloat(v.total||0),0);
    const car=ok.filter(v=>v.paiement==='carte').reduce((s,v)=>s+parseFloat(v.total||0),0);
    const tvat=(esp+car)*0.06/1.06;
    const parJour={};
    ok.forEach(v=>{
      const j=v.date_heure.split('T')[0];
      if(!parJour[j]) parJour[j]={esp:0,car:0,nb:0};
      if(v.paiement==='espèces') parJour[j].esp+=parseFloat(v.total||0);
      else parJour[j].car+=parseFloat(v.total||0);
      parJour[j].nb++;
    });
    const w=window.open('','_blank');
    w.document.write(`<html><head><title>Relevé ${mois}</title>
    <style>body{font-family:sans-serif;padding:30px;max-width:800px;margin:auto}h1{color:#D3518B}
    table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#D3518B;color:#fff;padding:10px;text-align:left}
    td{padding:8px 10px;border-bottom:1px solid #eee}.right{text-align:right}
    .recap{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:20px 0}
    .box{background:#f5f5f5;padding:16px;border-radius:8px;text-align:center}
    .box b{display:block;font-size:24px;color:#D3518B}.box small{color:#888;font-size:12px}</style></head>
    <body><h1>🍬 Munchy's Candy — Relevé mensuel</h1>
    <p><b>Période :</b> ${new Date(annee,m-1,1).toLocaleDateString('fr-BE',{month:'long',year:'numeric'})}</p>
    <p>TVA BE 0750.497.413 · Mouscron, Belgique</p><hr>
    <div class="recap">
      <div class="box"><b>${(esp+car).toFixed(2)}€</b><small>CA TTC</small></div>
      <div class="box"><b>${tvat.toFixed(2)}€</b><small>dont TVA 6%</small></div>
      <div class="box"><b>${ok.length}</b><small>Transactions</small></div>
    </div>
    <div class="recap">
      <div class="box"><b style="color:#78B7A0">${esp.toFixed(2)}€</b><small>💵 Espèces</small></div>
      <div class="box"><b>${car.toFixed(2)}€</b><small>💳 Carte</small></div>
      <div class="box"><b>${data.filter(v=>v.annulee).length}</b><small>⛔ Annulées</small></div>
    </div>
    <table><tr><th>Date</th><th>Nb</th><th class="right">Espèces</th><th class="right">Carte</th><th class="right">Total</th></tr>
    ${Object.entries(parJour).map(([j,d])=>`<tr>
      <td>${new Date(j+'T12:00:00').toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'})}</td>
      <td>${d.nb}</td><td class="right">${d.esp.toFixed(2)}€</td><td class="right">${d.car.toFixed(2)}€</td>
      <td class="right"><b>${(d.esp+d.car).toFixed(2)}€</b></td></tr>`).join('')}
    <tr style="background:#78B7A0;color:#fff"><td colspan="2"><b>TOTAL</b></td>
    <td class="right">${esp.toFixed(2)}€</td><td class="right">${car.toFixed(2)}€</td><td class="right">${(esp+car).toFixed(2)}€</td></tr>
    </table>
    <p style="color:#888;font-size:11px">Généré le ${new Date().toLocaleString('fr-BE')}</p>
    <script>window.print();</script></body></html>`);
  };
  // ANNULER VENTE - avec gestion erreur
  const annulerVente = async (id, motif) => {
    if(!motif||!motif.trim()){alert("Motif obligatoire");return;}
    if(testMode){
      setTestVentes(prev=>prev.map(v=>v.id===id?{...v,annulee:true,note_annulation:motif}:v));
      alert("✅ Vente test annulée !");
      return;
    }
    try{
      const r=await fetch(`${SUPABASE_URL}/rest/v1/ventes?id=eq.${id}`,{
        method:'PATCH',
        headers:{...SB,Prefer:"return=representation"},
        body:JSON.stringify({annulee:true,note_annulation:motif})
      });
      if(r.ok){
        alert("✅ Vente annulée !");
        loadVentes(journalDate);
      } else {
        const err=await r.text();
        alert("❌ Erreur "+r.status+": "+err);
      }
    }catch(e){alert("❌ Erreur réseau: "+e.message);}
  };
  // Recherche Open Food Facts si produit non trouvé localement
  const lookupBarcode = async (code) => {
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      const data = await r.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const nom = p.product_name_fr || p.product_name || p.generic_name_fr || p.generic_name || '';
        const marque = p.brands || '';
        return nom ? `${nom}${marque ? ' — '+marque : ''}` : null;
      }
    } catch(e) {}
    return null;
  };
  const sendReceiptByEmail = async (email, r) => {
    if(!email||!email.includes('@')){ alert('Email invalide'); return; }
    setSendingReceiptEmail(true);
    const html = `<div style="font-family:monospace;max-width:400px;margin:auto;padding:20px;background:#f9f9f9;border-radius:12px">
      <h2 style="color:#D3518B;text-align:center">🍬 MUNCHY'S CANDY</h2>
      <p style="text-align:center;color:#888;font-size:12px">Mouscron · TVA BE 0750.497.413</p>
      <p style="text-align:center;color:#888;font-size:12px">${new Date(r.date).toLocaleString('fr-BE')}</p>
      <hr>
      <table style="width:100%;font-size:13px">
        ${r.cart.map(i=>`<tr><td>${i.nom} x${i.qty}</td><td style="text-align:right">${(i.prix*i.qty).toFixed(2)}€</td></tr>`).join('')}
      </table>
      <hr>
      ${r.discountAmt>0?`<p style="color:#ff9800">💸 Remise: −${r.discountAmt.toFixed(2)}€</p>`:''}
      ${r.cagnotteUsed>0?`<p style="color:#D3518B">🎁 Cagnotte: −${r.cagnotteUsed.toFixed(2)}€</p>`:''}
      <p style="font-size:18px;font-weight:bold">TOTAL TTC: ${r.finalTotal.toFixed(2)}€</p>
      <p style="color:#888;font-size:11px">dont TVA 6%: ${r.tva.toFixed(2)}€</p>
      <p>Paiement: ${r.method==='carte'?'💳 Carte':'💵 Espèces'}</p>
      ${r.client?`<hr><p style="color:#4caf50">💳 Cashback +${r.cashback.toFixed(2)}€ · Solde: ${(Math.max(0,(r.client.cagnotte||0)-r.cagnotteUsed+r.cashback)).toFixed(2)}€</p>`:''}
      <hr>
      <p style="text-align:center;color:#D3518B;font-weight:bold">Merci de votre visite ! 🍬</p>
    </div>`;
    try {
      const resp = await fetch("https://swrpladhwaspibpoegwn.supabase.co/functions/v1/smooth-action",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer sb_publishable_1m5yOZvVzFfXQQYqoN8h_A_nd56vaPI"},
        body:JSON.stringify({to:email,subject:"🍬 Votre ticket Munchy's Candy",html})
      });
      const d = await resp.json();
      if(d.id){ alert('✅ Ticket envoyé à '+email+' !'); setReceiptEmail(''); }
      else { alert('❌ Erreur: '+JSON.stringify(d)); }
    } catch(e){ alert('❌ Erreur: '+e.message); }
    setSendingReceiptEmail(false);
  };
  const sendEmail = async () => {
    if(!emailSubject||!emailBody){alert("Remplissez tous les champs");return;}
    setSendingEmail(true);
    try{
      const r=await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{"Authorization":"Bearer re_PGnLJC4M_7XzWAhEPeJq7i9nQaBqEMBJn","Content-Type":"application/json"},
        body:JSON.stringify({from:"contact@munchyscandy.fr",to:[emailClient.email],subject:emailSubject,
          html:`<div style="font-family:sans-serif;max-width:600px;margin:auto"><h2 style="color:#D3518B">🍬 Munchy's Candy</h2><p>${emailBody.replace(/\n/g,'<br>')}</p><hr><p style="color:#888;font-size:12px">Munchy's Candy · Mouscron, Belgique</p></div>`})
      });
      if(r.ok){alert("✅ Email envoyé !");setEmailClient(null);setEmailSubject('');setEmailBody('');}
      else{const e=await r.json();alert("Erreur: "+(e.message||'inconnue'));}
    }catch(e){alert("Erreur: "+e.message);}
    setSendingEmail(false);
  };
  const boxFilteredProducts = allProducts.filter(p=>!boxSearch||p.nom.toLowerCase().includes(boxSearch.toLowerCase()));
  const settingsProducts = allProducts.filter(p=>!settingsSearch||p.nom.toLowerCase().includes(settingsSearch.toLowerCase()));
  const displayVentes = testMode?testVentes:ventes;
  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={S.logo}>🍬 MUNCHY'S</div>
        <div style={{flex:1}}>
          <input style={S.searchInput} placeholder="Rechercher un produit..."
            ref={searchRef}
            value={search} onChange={e=>setSearch(e.target.value)}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
            onKeyDown={async e=>{
              const isEnter = e.key==='Enter' || e.keyCode===13 || e.which===13;
              if(isEnter && search.trim()){
                if(/^\d{6,}$/.test(search.trim())){
                  const code = search.trim();
                  setSearch('');
                  const found = allProductsRef.current.find(p=>p.barcode&&String(p.barcode).trim()===code);
                  if(found){ addToCart(found); }
                  else {
                    const nom = await lookupBarcode(code);
                    if(nom){
                      const ok = window.confirm('Trouvé: "'+nom+'"\n\nAjouter au catalogue ?');
                      if(ok){ setEditProduct({nom,categorie:'Autres',prix:'',vrac:false,barcode:code,photo_url:''}); setIsNew(true); setShowSettings(true); setSettingsTab('produits'); }
                    } else { alert('Code '+code+' inconnu.\nVa dans Produits pour l\'associer manuellement.'); }
                  }
                }
              }
            }}/>
        </div>
        <div style={S.hRight}>
          <button style={{...S.btnD,fontSize:20,padding:'8px 14px'}} onClick={()=>{
            window._scannerInit=false;
            window._scanned=false;
            if(window._html5QrCode){try{window._html5QrCode.stop().catch(()=>{});}catch(e){}}
            window._html5QrCode=null;
            setScanMode('cart');
            setShowBarcodeScanner(true);
          }}>📷</button>
          <input style={{display:'none'}} value={barcode} onChange={e=>setBarcode(e.target.value)} onKeyDown={handleBarcode}/>
          <button style={S.btnW} onClick={()=>setModal('vrac')}>⚖️</button>
          <button style={S.btnD} onClick={()=>{setModal('loyalty');setLoySearch('');setLoyResults([]);loadClients();}}>💳</button>
          <button style={S.btnD} onClick={()=>{if(pinUnlocked){setShowSettings(true);loadStock();}else{setShowPinModal(true);}}}>⚙️</button>
        </div>
      </div>
      <div style={S.main}>
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
                {p.photo_url?<img src={p.photo_url} style={S.cardImg} onError={e=>{e.target.style.display='none';e.target.nextSibling&&(e.target.nextSibling.style.display='block');}}/>:null}
                <div style={{fontSize:22,display:p.photo_url?'none':'block'}}>{EMO[p.categorie]||'🍬'}</div>
                <div style={S.cardName}>{p.nom}</div>
                <div style={S.cardPrice}>{p.vrac?`${p.prix.toFixed(2)}€/100g`:`${p.prix.toFixed(2)}€`}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={S.right}>
          <div style={S.cartHead}>
            🛒 CAISSE {testMode&&<span style={{background:'#ff9800',color:'#000',fontSize:10,fontWeight:900,padding:'2px 7px',borderRadius:6,marginLeft:8}}>🧪 TEST</span>}
            {client&&(
              <div style={S.loyCard}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontWeight:800,fontSize:13}}>💳 {client.name}</span>
                  <button style={S.btnX} onClick={()=>{setClient(null);setUseCagnotte(false);}}>✕</button>
                </div>
                <div style={{fontSize:12,color:'#aaa',margin:'3px 0'}}>Cagnotte: <b style={{color:C1}}>{cagnotte.toFixed(2)}€</b></div>
                {cagnotte>0&&(
                  <div style={{display:'flex',gap:5,marginTop:5}}>
                    <button style={{...S.cogBtn,...(useCagnotte?S.cogOn:{})}} onClick={()=>setUseCagnotte(true)}>✅ -{Math.min(cagnotte,cartTotal).toFixed(2)}€</button>
                    <button style={{...S.cogBtn,...(!useCagnotte?S.cogOff:{})}} onClick={()=>setUseCagnotte(false)}>❌ Garder</button>
                  </div>
                )}
                {client.email&&<button style={S.emailBtn} onClick={()=>{setEmailClient(client);setEmailSubject("Un message de Munchy's 🍬");setEmailBody(`Bonjour ${client.name},\n\n`);}}>✉️ Email</button>}
              </div>
            )}
          </div>
          <div style={S.items}>
            {!cart.length&&<div style={S.empty}>Aucun article</div>}
            {cart.map(item=>(
              <div key={item.cartId} style={S.item}>
                <div style={S.iName}>{item.nom}</div>
                <div style={S.iRow}>
                  {!item.vrac&&<><button style={S.qBtn} onClick={()=>updateQty(item.cartId,-1)}>−</button>
                  <span style={S.qNum}>{item.qty}</span>
                  <button style={S.qBtn} onClick={()=>updateQty(item.cartId,1)}>+</button></>}
                  <span style={{marginLeft:'auto',fontSize:13,fontWeight:800}}>{(item.prix*item.qty).toFixed(2)}€</span>
                  <button style={S.xBtn} onClick={()=>{if(confirm(`Supprimer "${item.nom}" ?`))removeItem(item.cartId);}}>✕</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{...S.footer,padding:'6px 8px',gap:4}}>
            {cagnotteUsed>0&&<div style={{...S.discRow,fontSize:11}}><span>🎁 Cagnotte</span><span>−{fmt(cagnotteUsed)}</span></div>}
            {discountAmt>0&&<div style={{...S.discRow,fontSize:11}}><span>💸 {discountType==='percent'?`${discount}%`:''}</span><span>−{fmt(discountAmt)}</span></div>}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:12,color:'rgba(255,255,255,0.8)'}}>TOTAL TTC</span>
              <span style={{...S.totalAmt,fontSize:18}}>{fmt(finalTotal)}</span>
            </div>
            <div style={{display:'flex',gap:5}}>
              <button style={{...S.payBtn,...S.payCard,padding:'10px 4px',fontSize:12}} onClick={()=>cart.length>0&&setModal('payment')} disabled={!cart.length}>💳 CARTE</button>
              <button style={{...S.payBtn,...S.payCash,padding:'10px 4px',fontSize:12}} onClick={()=>cart.length>0&&setModal('cash')} disabled={!cart.length}>💵 ESPÈCES</button>
            </div>
            <div style={{display:'flex',gap:5}}>
              <button style={{...S.remiseBtn,padding:'7px 6px',fontSize:11}} onClick={()=>{setDiscountInput('');setModal('discount');}}>💸 Remise</button>
              {discount>0&&<button style={{...S.clearRemise,padding:'7px 8px',fontSize:11}} onClick={()=>setDiscount(0)}>✕</button>}
              <button style={{...S.clearBtn,padding:'7px 10px',fontSize:13,flexShrink:0}} onClick={newSale}>🗑️</button>
            </div>
          </div>
        </div>
      </div>
      {/* SETTINGS */}
      {showSettings&&(
        <div style={S.settingsOverlay}>
          <div style={S.settingsPanel} className='settings-content'>
            <div style={S.settingsHead}>
              <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                <button style={{...S.tabBtn,...(settingsTab==='produits'?S.tabActive:{})}} onClick={()=>setSettingsTab('produits')}>🛍️ Produits</button>
                <button style={{...S.tabBtn,...(settingsTab==='box'?S.tabActive:{})}} onClick={()=>setSettingsTab('box')}>📦 Box</button>
                <button style={{...S.tabBtn,...(settingsTab==='stock'?S.tabActive:{})}} onClick={()=>{setSettingsTab('stock');loadStock();}}>📊 Stock</button>
                <button style={{...S.tabBtn,...(settingsTab==='ventes'?S.tabActive:{})}} onClick={()=>{setSettingsTab('ventes');loadVentes(journalDate);}}>🧾 Ventes</button>
                <button style={{...S.tabBtn,...(settingsTab==='caisse'?S.tabActive:{})}} onClick={()=>setSettingsTab('caisse')}>🏦 Caisse</button>
              </div>
              <div style={{display:'flex',gap:6}}>
                {settingsTab==='produits'&&<button style={S.btnAdd} onClick={()=>openEdit(null,true)}>+ Nouveau</button>}
                {settingsTab==='box'&&<button style={S.btnAdd} onClick={newBox}>+ Nouvelle box</button>}
                {settingsTab==='caisse'&&!session&&<button style={S.btnAdd} onClick={()=>setShowOpenSession(true)}>🏦 Ouvrir</button>}
                {settingsTab==='caisse'&&session&&<button style={{...S.btnAdd,background:'#ff5555',color:'#fff'}} onClick={()=>{setShowCloseSession(true);loadClosingData();}}>🔒 Fermer</button>}
                <button style={{...S.tabBtn,background:testMode?'rgba(255,165,0,0.9)':'rgba(0,0,0,0.3)',color:'#fff',border:'none',fontSize:11}} onClick={()=>setTestMode(t=>!t)}>
                  {testMode?'🧪 ON':'🧪 TEST'}
                </button>
                <button style={S.settingsClose} onClick={()=>setShowSettings(false)}>✕</button>
              </div>
            </div>
            {settingsTab==='produits'&&(
              <>
                <input style={S.settingsSearch} placeholder="Rechercher..." value={settingsSearch} onChange={e=>setSettingsSearch(e.target.value)} autoComplete="off"/>
                <div style={S.settingsList}>
                  {settingsProducts.slice(0,200).map(p=>(
                    <div key={p.id} style={S.sItem}>
                      {p.photo_url?<img src={p.photo_url} style={S.sThumb} onError={e=>e.target.style.display='none'}/>
                        :<div style={{fontSize:24,width:40,textAlign:'center'}}>{EMO[p.categorie]||'🍬'}</div>}
                      <div style={{flex:1,overflow:'hidden'}}>
                        <div style={{fontSize:13,fontWeight:700,color:'#111',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.nom}</div>
                        <div style={{fontSize:11,color:'#333'}}>{p.categorie} · {p.vrac?`${p.prix.toFixed(2)}€/100g`:`${p.prix.toFixed(2)}€`}{p.barcode?` · ${p.barcode}`:''}</div>
                      </div>
                      <div style={{display:'flex',gap:5,flexShrink:0}}>
                        <button style={S.editBtn} onClick={()=>openEdit(p)}>✏️</button>
                        {p.custom_id
                          ?<button style={S.delBtn} onClick={()=>deleteProduct(p.custom_id)}>🗑️</button>
                          :<button style={S.delBtn} onClick={()=>hideBaseProduct(p)}>🗑️</button>}
                      </div>
                    </div>
                  ))}
                  {settingsProducts.length>200&&<div style={{color:'#888',padding:12,textAlign:'center',fontSize:12}}>Affinez la recherche</div>}
                </div>
              </>
            )}
            {settingsTab==='box'&&(
              <div style={S.settingsList}>
                {!boxes.length&&<div style={{color:'#888',textAlign:'center',padding:30}}>Aucune box enregistrée</div>}
                {boxes.map(b=>{
                  const prods=typeof b.produits==='string'?JSON.parse(b.produits):b.produits;
                  return(
                    <div key={b.id} style={{...S.sItem,flexDirection:'column',alignItems:'flex-start',gap:6}}>
                      <div style={{display:'flex',justifyContent:'space-between',width:'100%',alignItems:'center'}}>
                        <div>
                          <div style={{fontWeight:800,fontSize:14,color:'#111'}}>📦 {b.box_nom}</div>
                          <div style={{fontSize:12,color:'#555'}}>{b.date_vente} · {prods.length} produit(s) · {prods.reduce((s,p)=>s+p.prix*p.qty,0).toFixed(2)}€</div>
                        </div>
                        <div style={{display:'flex',gap:6}}>
                          <button style={{...S.editBtn,background:'rgba(76,175,80,0.2)',color:'#4caf50'}} onClick={()=>printBox(b)}>🖨️</button>
                          <button style={{...S.editBtn,background:'rgba(255,165,0,0.2)',color:'#ffa500'}} onClick={async()=>{
                            const nb = parseInt(prompt('Combien de boxes à annuler (remettre en stock) ?'));
                            if(!nb||nb<=0) return;
                            const prods = typeof b.produits==='string'?JSON.parse(b.produits):b.produits;
                            await restoreStock(prods, nb);
                            alert(nb+' box(es) annulée(s) — stock remis à jour !');
                          }}>↩️</button>
                          <button style={S.delBtn} onClick={()=>deleteBox(b.id)}>🗑️</button>
                        </div>
                      </div>
                      <div style={{fontSize:12,color:'#ccc'}}>{prods.map(p=>`${p.nom} x${p.qty}`).join(' · ')}</div>
                      {b.notes&&<div style={{fontSize:11,color:'#888',fontStyle:'italic'}}>📝 {b.notes}</div>}
                    </div>
                  );
                })}
              </div>
            )}
            {settingsTab==='ventes'&&(
              <>
                <div style={{padding:'10px 16px 6px',display:'flex',gap:10,alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
                  <input type="date" style={{...S.eInput,width:'auto',padding:'6px 12px'}}
                    value={journalDate} onChange={e=>{setJournalDate(e.target.value);loadVentes(e.target.value);}}/>
                  {testMode&&<span style={{background:'#ff9800',color:'#000',fontSize:10,fontWeight:900,padding:'2px 8px',borderRadius:6}}>🧪 TEST</span>}
                  <button style={{...S.editBtn,background:'rgba(120,183,160,0.15)',color:C2,fontSize:12,padding:'5px 10px'}}
                    onClick={()=>setShowExportModal(true)}>📥 Exporter</button>
                  <span style={{fontSize:12,color:'#888'}}>💳 <b style={{color:C1}}>{displayVentes.filter(v=>!v.annulee&&v.paiement==='carte').reduce((s,v)=>s+parseFloat(v.total||0),0).toFixed(2)}€</b></span>
                  <span style={{fontSize:12,color:'#888'}}>💵 <b style={{color:C2}}>{displayVentes.filter(v=>!v.annulee&&v.paiement==='espèces').reduce((s,v)=>s+parseFloat(v.total||0),0).toFixed(2)}€</b></span>
                  <span style={{fontSize:12,color:'#888'}}>Total: <b style={{color:'#fff'}}>{displayVentes.filter(v=>!v.annulee).reduce((s,v)=>s+parseFloat(v.total||0),0).toFixed(2)}€</b></span>
                </div>
                <div style={S.settingsList}>
                  {!displayVentes.length&&<div style={{color:'#888',textAlign:'center',padding:30}}>{testMode?'Aucune vente test':'Aucune vente ce jour'}</div>}
                  {displayVentes.map(v=>{
                    const arts=typeof v.articles==='string'?JSON.parse(v.articles):v.articles;
                    return(
                      <div key={v.id} style={{...S.sItem,flexDirection:'column',alignItems:'flex-start',gap:4,opacity:v.annulee?0.4:1}}>
                        <div style={{display:'flex',justifyContent:'space-between',width:'100%',alignItems:'center'}}>
                          <div>
                            <span style={{fontWeight:800,fontSize:15,color:v.paiement==='carte'?C1:C2}}>
                              {v.paiement==='carte'?'💳':'💵'} {parseFloat(v.total).toFixed(2)}€
                            </span>
                            {v.client_nom&&<span style={{fontSize:12,color:'#aaa',marginLeft:10}}>👤 {v.client_nom}</span>}
                            {v.annulee&&<span style={{fontSize:11,color:'#ff5555',marginLeft:8}}>⛔ ANNULÉE</span>}
                          </div>
                          <div style={{display:'flex',gap:6,alignItems:'center'}}>
                            <span style={{fontSize:11,color:'#555'}}>{new Date(v.date_heure).toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'})}</span>
                            {!v.annulee&&(
                              <button style={S.delBtn} onClick={()=>{
                                const motif=prompt("Motif d'annulation (obligatoire) :");
                                if(motif!==null&&motif.trim()) annulerVente(v.id,motif);
                                else if(motif!==null) alert("Le motif est obligatoire !");
                              }}>⛔</button>
                            )}
                          </div>
                        </div>
                        <div style={{fontSize:11,color:'#777'}}>{(arts||[]).map(a=>`${a.nom} x${a.qty}`).join(' · ')}</div>
                        {v.note_annulation&&<div style={{fontSize:11,color:'#ff5555',fontStyle:'italic'}}>Motif: {v.note_annulation}</div>}
                        {v.remise>0&&<div style={{fontSize:11,color:'#ffa500'}}>Remise: -{parseFloat(v.remise).toFixed(2)}€</div>}
                      </div>
                    );
                    })
            
                </div>
              </>
            )}
            {settingsTab==='caisse'&&(
              <div style={{padding:20,flex:1,overflowY:'auto'}}>
                {!session?(
                  <div style={{textAlign:'center',padding:30}}>
                    <div style={{fontSize:48,marginBottom:12}}>🏦</div>
                    <div style={{fontSize:16,fontWeight:700,color:'#aaa',marginBottom:6}}>Caisse non ouverte</div>
                    <div style={{fontSize:13,color:'#666'}}>Ouvre la caisse le matin en entrant le fond de caisse</div>
                  </div>
                ):(
                  <div style={{background:'rgba(255,255,255,0.3)',border:'1px solid rgba(0,0,0,0.1)',borderRadius:14,padding:16}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#1a5c3a',marginBottom:10}}>✅ Caisse ouverte depuis {new Date(session.date_ouverture).toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'})}</div>
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{color:'#222',fontSize:13}}>Fond d'ouverture</span>
                      <span style={{fontWeight:900,fontSize:18,color:'#111'}}>{parseFloat(session.montant_ouverture||0).toFixed(2)}€</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {settingsTab==='stock'&&(
              <>
                <div style={{display:'flex',gap:8,margin:'10px 14px 6px',alignItems:'center'}}>
                  <input style={{...S.settingsSearch,margin:0,flex:1}} placeholder="🔍 Rechercher ou scanner..." 
                    value={stockSearch} onChange={e=>setStockSearch(e.target.value)} autoComplete="off"
                    id="stock-search-input"/>
                </div>
                <div style={{padding:'4px 16px 8px',fontSize:12,color:'#555'}}>
                  {allProducts.length} produits · <b>Scanne ou clique</b> un produit pour modifier le stock · 🟢 OK · 🟡 Bas · 🔴 Vide · ⬜ Non saisi
                  {stockScanned&&<span style={{marginLeft:8,color:'#D3518B',fontWeight:700}}>→ {stockScanned.nom}</span>}
                </div>
                <div style={S.settingsList}>
                  {allProducts.filter(p=>!stockSearch||p.nom.toLowerCase().includes(stockSearch.toLowerCase())).slice(0,300).map(p=>{
                    const s=stockData.find(sd=>sd.product_nom===p.nom);
                    const qty=s?s.quantite:null;
                    const seuil=s?s.seuil_alerte:5;
                    const dot=qty===null?'⬜':qty<=0?'🔴':qty<=seuil?'🟡':'🟢';
                    const color=qty===null?'#555':qty<=0?'#ff5555':qty<=seuil?'#ffa500':'#4caf50';
                    return(
                      <div key={p.id} id={`stock-item-${p.id}`} style={{...S.sItem,cursor:'pointer',border:stockScanned?.id===p.id?'2px solid #D3518B':'1px solid #e9ecef',background:stockScanned?.id===p.id?'#fff0f6':'#f8f9fa'}} onClick={()=>{setEditingStock(p);setStockQty(qty!==null?String(qty):'0');setStockAlert(String(seuil));setStockScanned(null);}}>
                        <div style={{fontSize:20,width:30,textAlign:'center',flexShrink:0}}>{dot}</div>
                        <div style={{flex:1,overflow:'hidden'}}>
                          <div style={{fontSize:13,fontWeight:700,color:'#111',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.nom}</div>
                          <div style={{fontSize:11,color:'#777'}}>{p.categorie}</div>
                        </div>
                        <div style={{textAlign:'right',flexShrink:0,marginRight:8}}>
                          <div style={{fontSize:20,fontWeight:900,color,lineHeight:1}}>{qty!==null?qty:'—'}</div>
                          <div style={{fontSize:10,color:'#555'}}>unités</div>
                        </div>
                        {s&&qty>0&&<button style={{...S.editBtn,background:'rgba(76,175,80,0.15)',color:'#4caf50',fontSize:12,padding:'5px 8px'}}
                          onClick={e=>{e.stopPropagation();const n=parseInt(prompt(`Ajouter combien à "${p.nom}" ?`)||'0');if(n>0)addStock(p.nom,n);}}>+</button>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* EDIT STOCK */}
      {editingStock&&(
        <div style={S.overlay}>
          <div style={{...S.modal,width:380}}>
            <h2 style={S.mTitle}>📊 {editingStock.nom}</h2>
            <div style={{display:'flex',flexDirection:'column',gap:14,marginBottom:18}}>
              <div><label style={{fontSize:13,color:'#888',fontWeight:700,display:'block',marginBottom:7}}>Quantité actuelle</label>
              <input style={{...S.eInput,fontSize:32,textAlign:'center',fontWeight:900,padding:'14px'}} type="number" min="0" value={stockQty} onChange={e=>setStockQty(e.target.value)} autoFocus/></div>
              <div><label style={{fontSize:13,color:'#888',fontWeight:700,display:'block',marginBottom:7}}>Seuil d'alerte</label>
              <input style={S.eInput} type="number" min="0" value={stockAlert} onChange={e=>setStockAlert(e.target.value)}/></div>
            </div>
            <div style={S.mBtns}>
              <button style={S.btnCancel} onClick={()=>setEditingStock(null)}>Annuler</button>
              <button style={S.btnConfirm} onClick={async()=>{await upsertStock(editingStock.nom,parseInt(stockQty)||0,parseInt(stockAlert)||5);setEditingStock(null);}}>💾 Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
      {/* EDIT BOX */}
      {editBox&&(
        <div style={S.overlay}>
          <div style={{...S.modal,width:600,maxHeight:'90vh',overflowY:'auto'}}>
            <h2 style={S.mTitle}>📦 Préparer une Box Mystère</h2>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10,marginBottom:14}}>
              <div><label style={S.eLabel}>Type</label>
              <select style={S.eInput} value={editBox.nom} onChange={e=>setEditBox(b=>({...b,nom:e.target.value,prix:e.target.value.includes('20')?20:10}))}>
                <option>Box Mystère 10€</option><option>Box Mystère 20€</option></select></div>
              <div><label style={S.eLabel}>Date</label>
              <input type="date" style={S.eInput} value={editBox.date} onChange={e=>setEditBox(b=>({...b,date:e.target.value}))}/></div>
              <div><label style={S.eLabel}>Prix vente</label>
              <input type="number" style={S.eInput} value={editBox.prix} onChange={e=>setEditBox(b=>({...b,prix:parseFloat(e.target.value)}))}/></div>
              <div><label style={S.eLabel}>Nb de boxes</label>
              <input type="number" style={{...S.eInput,fontWeight:900}} min="1" value={boxQuantite} onChange={e=>setBoxQuantite(parseInt(e.target.value)||1)}/></div>
            </div>
            <div style={{display:'flex',gap:12,marginBottom:14}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:C1,marginBottom:6,fontSize:13}}>📋 Contenu :</div>
                {!editBox.produits.length&&<div style={{color:'#666',fontSize:12}}>Aucun produit</div>}
                {editBox.produits.map(p=>(
                  <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 8px',background:'rgba(211,81,139,0.08)',borderRadius:7,marginBottom:4}}>
                    <span style={{fontSize:12,color:'#ddd'}}>{p.nom} x{p.qty}</span>
                    <span style={{fontSize:12,color:C1,fontWeight:700}}>{(p.prix*p.qty).toFixed(2)}€</span>
                    <button style={{...S.xBtn,width:18,height:18}} onClick={()=>removeFromBox(p.id)}>✕</button>
                  </div>
                ))}
                {editBox.produits.length>0&&<div style={{fontWeight:700,color:'#4caf50',fontSize:13,marginTop:8}}>Total: {editBox.produits.reduce((s,p)=>s+p.prix*p.qty,0).toFixed(2)}€</div>}
                <textarea style={{...S.eInput,width:'100%',minHeight:60,marginTop:10,resize:'vertical'}}
                  placeholder="Notes comptable..." value={editBox.notes||''} onChange={e=>setEditBox(b=>({...b,notes:e.target.value}))}/>
              </div>
              <div style={{flex:1}}>
                <input style={S.settingsSearch} placeholder="🔍 Chercher ou scanner..." 
                  value={boxSearch} onChange={e=>setBoxSearch(e.target.value)} autoComplete="off"
                  onKeyDown={e=>{
                    if(e.key==='Enter' && boxSearch.trim()){
                      // Si c'est un code-barres (chiffres)
                      if(/^\d{6,}$/.test(boxSearch.trim())){
                        const found = allProductsRef.current.find(p=>p.barcode&&String(p.barcode).trim()===boxSearch.trim());
                        if(found){ addToBox(found); setBoxSearch(''); }
                        else { alert('Code '+boxSearch+' non trouvé. Associez-le dans Produits.'); setBoxSearch(''); }
                      } else {
                        // Si texte et un seul résultat → ajouter direct
                        if(boxFilteredProducts.length===1){ addToBox(boxFilteredProducts[0]); setBoxSearch(''); }
                      }
                    }
                  }}/>
                <div style={{maxHeight:280,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
                  {boxFilteredProducts.slice(0,100).map(p=>(
                    <button key={p.id} style={{padding:'6px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)',color:'#ddd',cursor:'pointer',textAlign:'left',fontSize:12}}
                      onClick={()=>addToBox(p)}><b style={{color:C1}}>{p.prix.toFixed(2)}€</b> · {p.nom}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={S.mBtns}>
              <button style={S.btnCancel} onClick={()=>setEditBox(null)}>Annuler</button>
              <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#555',cursor:'pointer'}}>
                <input type="checkbox" checked={boxGenPDF} onChange={e=>setBoxGenPDF(e.target.checked)} style={{width:16,height:16,cursor:'pointer'}}/>
                Générer le PDF après enregistrement
              </label>
              <button style={S.btnConfirm} onClick={async()=>{ await saveBox(); if(boxGenPDF) printBox(editBox); }}>💾 Enregistrer</button>
            </div>
          </div>
        </div>
      )}
      {/* EDIT PRODUCT */}
      {editProduct&&(
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
                <input style={{...S.eInput,flex:1}} value={editProduct.barcode} 
                  onChange={e=>setEditProduct(p=>({...p,barcode:e.target.value}))} 
                  placeholder="Scanne ou tape le code..."
                  autoFocus={!editProduct.nom}/>
              </div>
              <label style={S.eLabel}>Photo</label>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                <div style={{display:'flex',gap:8}}>
                  <label style={{...S.uploadBtn,flex:1,textAlign:'center',opacity:uploading?0.6:1}}>
                    {uploading?'⏳...':'🖼️ Galerie'}
                    <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files[0]&&uploadPhoto(e.target.files[0])} disabled={uploading}/>
                  </label>
                  <label style={{...S.uploadBtn,flex:1,textAlign:'center',opacity:uploading?0.6:1,background:'linear-gradient(135deg,#78B7A0,#3d7a63)'}}>
                    {uploading?'⏳...':'📷 Caméra'}
                    <input type="file" accept="image/*;capture=camera" capture style={{display:'none'}} onChange={e=>e.target.files[0]&&uploadPhoto(e.target.files[0])} disabled={uploading}/>
                  </label>
                </div>
                {editProduct.photo_url&&(
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
      {/* DISCOUNT */}
      {modal==='discount'&&(
        <div style={S.overlay}><div style={S.modal}>
          <h2 style={S.mTitle}>💸 Appliquer une remise</h2>
          <div style={{display:'flex',gap:8,marginBottom:16}}>
            <button style={{...S.cogBtn,...(discountType==='percent'?S.cogOn:{})}} onClick={()=>setDiscountType('percent')}>% Pourcentage</button>
            <button style={{...S.cogBtn,...(discountType==='fixed'?S.cogOn:{})}} onClick={()=>setDiscountType('fixed')}>€ Montant fixe</button>
          </div>
          <input style={{...S.eInput,fontSize:20,textAlign:'center',marginBottom:16}} placeholder={discountType==='percent'?'Ex: 10':'Ex: 5'} value={discountInput} onChange={e=>setDiscountInput(e.target.value)} autoFocus/>
          <div style={S.mBtns}>
            <button style={S.btnCancel} onClick={()=>setModal(null)}>Annuler</button>
            <button style={S.btnConfirm} onClick={applyDiscount}>✓ Appliquer</button>
          </div>
        </div></div>
      )}
      {/* LOYALTY */}
      {modal==='loyalty'&&(
        <div style={S.overlay}><div style={{...S.modal,width:460}}>
          <h2 style={S.mTitle}>💳 Carte fidélité</h2>
          <p style={{color:'#888',fontSize:13,textAlign:'center',marginBottom:10}}>QR code, téléphone ou nom</p>
          <p style={{color:allClients.length>0?'#4caf50':'#ff5555',fontSize:12,textAlign:'center',marginBottom:10}}>
            {allClients.length>0?`✅ ${allClients.length} clients`:'⏳ Chargement...'}
          </p>
          <input style={{...S.eInput,marginBottom:10,fontSize:15}} placeholder="Rechercher..." value={loySearch}
            onChange={e=>{setLoySearch(e.target.value);searchClient(e.target.value);}} autoFocus/>
          {loyResults.length>0&&(
            <div style={{maxHeight:220,overflowY:'auto',marginBottom:14,display:'flex',flexDirection:'column',gap:5}}>
              {loyResults.map(c=>(
                <button key={c.id} style={{padding:'10px 14px',borderRadius:10,border:`1px solid rgba(211,81,139,0.2)`,background:`rgba(211,81,139,0.05)`,color:'#fff',cursor:'pointer',textAlign:'left'}}
                  onClick={()=>{setClient(c);setUseCagnotte(false);setModal(null);setLoySearch('');setLoyResults([]);}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontWeight:700}}>{c.name}</span>
                    <span style={{color:C1,fontWeight:800}}>💰 {(c.cagnotte||0).toFixed(2)}€</span>
                  </div>
                  <div style={{fontSize:12,color:'#aaa'}}>{c.phone||''}{c.email?` · ${c.email}`:''}</div>
                </button>
              ))}
            </div>
          )}
          {loySearch.length>1&&!loyResults.length&&<div style={{color:'#888',textAlign:'center',marginBottom:14}}>Aucun client trouvé</div>}
          <button style={S.btnCancel} onClick={()=>{setModal(null);setLoySearch('');setLoyResults([]);}}>Annuler</button>
        </div></div>
      )}
      {/* VRAC */}
      {modal==='vrac'&&(
        <div style={S.overlay}><div style={S.modal}>
          <h2 style={S.mTitle}>⚖️ Bonbons en vrac</h2>
          <p style={{color:'#888',fontSize:13,textAlign:'center',marginBottom:16}}>1,50€ / 100g</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:14}}>
            {['1','2','3','4','5','6','7','8','9','0','00','⌫'].map(k=>(
              <button key={k} style={{padding:14,borderRadius:10,border:'1px solid #ddd',background:'#f0f0f0',color:'#111',fontSize:20,fontWeight:800,cursor:'pointer'}}
                onClick={()=>k==='⌫'?setVracG(v=>v.slice(0,-1)):setVracG(v=>v+k)}>{k}</button>
            ))}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',background:'#f8f8f8',border:'1px solid #eee',borderRadius:10,padding:'12px 16px',marginBottom:16}}>
            <span style={{fontSize:24,fontWeight:900,color:'#111'}}>{vracG||'0'} g</span>
          </div>
          <div style={S.mBtns}>
            <button style={S.btnCancel} onClick={()=>{setModal(null);setVracG('');}}>Annuler</button>
            <button style={S.btnConfirm} onClick={handleVrac}>Ajouter ✓</button>
          </div>
        </div></div>
      )}
      {/* CASH */}
      {modal==='cash'&&(
        <div style={S.overlay}><div style={S.modal}>
          <h2 style={S.mTitle}>💵 Paiement espèces</h2>
          <div style={{fontSize:42,fontWeight:900,textAlign:'center',color:'#111',marginBottom:6,letterSpacing:'-1px'}}>{fmt(finalTotal)}</div>
          <p style={{color:'#555',fontSize:12,textAlign:'center',marginBottom:16}}>Montant à encaisser</p>
          <label style={{fontSize:13,color:'#555',fontWeight:700,display:'block',marginBottom:8}}>💶 Montant donné (optionnel)</label>
          <input style={{...S.eInput,fontSize:26,textAlign:'center',fontWeight:900,padding:'12px',marginBottom:12}}
            type="number" step="0.01" min="0" placeholder="0,00" value={montantDonne} onChange={e=>setMontantDonne(e.target.value)} autoFocus/>
          {montantDonne&&parseFloat(montantDonne)>=finalTotal&&(
            <div style={{background:`linear-gradient(135deg,rgba(120,183,160,0.15),rgba(120,183,160,0.08))`,border:`1px solid rgba(120,183,160,0.3)`,borderRadius:14,padding:'14px 20px',marginBottom:16,textAlign:'center'}}>
              <div style={{fontSize:13,color:'#6a8a78',marginBottom:4}}>Monnaie à rendre</div>
              <div style={{fontSize:38,fontWeight:900,color:C2,letterSpacing:'-1px'}}>{fmt(parseFloat(montantDonne)-finalTotal)}</div>
            </div>
          )}
          {montantDonne&&parseFloat(montantDonne)<finalTotal&&(
            <div style={{background:'rgba(255,50,50,0.1)',border:'1px solid rgba(255,50,50,0.2)',borderRadius:12,padding:12,marginBottom:16,textAlign:'center',color:'#ff6b6b',fontSize:13,fontWeight:700}}>
              ⚠️ Insuffisant — manque {fmt(finalTotal-parseFloat(montantDonne))}
            </div>
          )}
          <div style={{display:'flex',gap:6,marginBottom:16}}>
            {[5,10,20,50].map(m=>(
              <button key={m} style={{flex:1,padding:'8px 4px',borderRadius:10,border:`1px solid rgba(120,183,160,0.2)`,background:`rgba(120,183,160,0.08)`,color:C2,fontWeight:700,fontSize:13,cursor:'pointer'}}
                onClick={()=>setMontantDonne(String(m))}>{m}€</button>
            ))}
          </div>
          <div style={S.mBtns}>
            <button style={S.btnCancel} onClick={()=>{setModal(null);setMontantDonne('');}}>Annuler</button>
            <button style={{...S.btnConfirm,opacity:montantDonne&&parseFloat(montantDonne)<finalTotal?0.5:1}}
              disabled={montantDonne&&parseFloat(montantDonne)<finalTotal}
              onClick={()=>{handlePayment('espèces');setMontantDonne('');}}>✅ Valider</button>
          </div>
        </div></div>
      )}
      {/* PAYMENT CARTE */}
      {modal==='payment'&&(
        <div style={S.overlay}><div style={S.modal}>
          <h2 style={S.mTitle}>💳 Paiement carte</h2>
          <div style={{fontSize:44,fontWeight:900,color:C1,textAlign:'center',margin:'18px 0'}}>{fmt(finalTotal)}</div>
          <p style={{color:'#888',fontSize:13,textAlign:'center',marginBottom:20}}>Présentez le terminal myPOS Go 2</p>
          <div style={S.mBtns}>
            <button style={S.btnCancel} onClick={()=>setModal(null)}>Annuler</button>
            <button style={S.btnConfirm} onClick={()=>handlePayment('carte')}>Paiement reçu ✓</button>
          </div>
        </div></div>
      )}
      {/* RECEIPT */}
      {modal==='receipt'&&receipt&&(
        <div style={S.overlay}>
          <div style={{...S.modal,width:370,maxHeight:'90vh',overflowY:'auto'}}>
            <div id="receipt" style={{fontFamily:'monospace',fontSize:12,lineHeight:1.6,color:'#ddd',paddingBottom:16}}>
              <div style={{textAlign:'center',marginBottom:8}}>
                <div style={{fontSize:16,fontWeight:900,color:C1}}>🍬 MUNCHY'S CANDY</div>
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
              {receipt.cagnotteUsed>0&&<div style={{display:'flex',justifyContent:'space-between',color:C1}}><span>🎁 Cagnotte</span><span>−{receipt.cagnotteUsed.toFixed(2)}€</span></div>}
              {receipt.discountAmt>0&&<div style={{display:'flex',justifyContent:'space-between',color:'#ff9800'}}><span>💸 Remise</span><span>−{receipt.discountAmt.toFixed(2)}€</span></div>}
              <div style={{display:'flex',justifyContent:'space-between',fontWeight:'bold',fontSize:16}}><span>TOTAL TTC</span><span>{receipt.finalTotal.toFixed(2)}€</span></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#888'}}><span>dont TVA 6%</span><span>{receipt.tva.toFixed(2)}€</span></div>
              <div style={{display:'flex',justifyContent:'space-between'}}><span>Paiement</span><span>{receipt.method==='carte'?'💳 Carte':'💵 Espèces'}</span></div>
              {receipt.client&&<>
                <div style={{color:'#444',margin:'6px 0'}}>{'─'.repeat(32)}</div>
                <div style={{display:'flex',justifyContent:'space-between',color:C1}}><span>💳 Cashback</span><span>+{receipt.cashback.toFixed(2)}€</span></div>
                <div style={{display:'flex',justifyContent:'space-between',color:'#4caf50',fontWeight:700}}><span>Nouveau solde</span><span>{(Math.max(0,(receipt.client.cagnotte||0)-receipt.cagnotteUsed+receipt.cashback)).toFixed(2)}€</span></div>
              </>}
              <div style={{color:'#444',margin:'6px 0'}}>{'─'.repeat(32)}</div>
              <div style={{textAlign:'center',color:C1,fontWeight:700}}>Merci de votre visite ! 🍬</div>
            </div>
            <div style={{marginTop:12,marginBottom:10}}>
              <div style={{fontSize:12,color:'#555',fontWeight:700,marginBottom:6}}>📧 Envoyer le ticket par email</div>
              <div style={{display:'flex',gap:6}}>
                <input style={{...S.eInput,flex:1,padding:'8px 12px',fontSize:13}}
                  type="email" placeholder={receipt.client?.email||"email@client.com"}
                  value={receiptEmail}
                  onChange={e=>setReceiptEmail(e.target.value)}
                  onFocus={()=>{ if(receipt.client?.email&&!receiptEmail) setReceiptEmail(receipt.client.email); }}/>
                <button style={{...S.btnConfirm,flex:'none',padding:'8px 14px',fontSize:13}}
                  onClick={()=>sendReceiptByEmail(receiptEmail||receipt.client?.email, receipt)}
                  disabled={sendingReceiptEmail}>
                  {sendingReceiptEmail?'⏳':'📧'}
                </button>
              </div>
            </div>
            <div style={S.mBtns}>
              <button style={S.btnCancel} onClick={()=>window.print()}>🖨️ Imprimer</button>
              <button style={S.btnConfirm} onClick={newSale}>Nouvelle vente ✓</button>
            </div>
          </div>
        </div>
      )}
      {/* EMAIL */}
      {emailClient&&(
        <div style={S.overlay}><div style={{...S.modal,width:500}}>
          <h2 style={S.mTitle}>✉️ Email à {emailClient.name}</h2>
          <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
            <input style={S.eInput} placeholder="Sujet..." value={emailSubject} onChange={e=>setEmailSubject(e.target.value)}/>
            <textarea style={{...S.eInput,minHeight:140,resize:'vertical'}} placeholder="Message..." value={emailBody} onChange={e=>setEmailBody(e.target.value)}/>
          </div>
          <div style={S.mBtns}>
            <button style={S.btnCancel} onClick={()=>{setEmailClient(null);setEmailSubject('');setEmailBody('');}}>Annuler</button>
            <button style={S.btnConfirm} onClick={sendEmail} disabled={sendingEmail}>{sendingEmail?'Envoi...':'✉️ Envoyer'}</button>
          </div>
        </div></div>
      )}
      {/* BARCODE SCANNER */}
      {showBarcodeScanner&&(editProduct||scanMode==='cart')&&(
        <div style={{...S.overlay,zIndex:400}}>
          <div style={{...S.modal,width:400,textAlign:'center'}}>
            <h2 style={S.mTitle}>{scanMode==='cart'?'📷 Scanner un produit':'📷 Enregistrer le code-barres'}</h2>
            <p style={{color:'#888',fontSize:13,marginBottom:14}}>Pointez la caméra vers le code-barres</p>
            <div id="barcode-reader" style={{width:"100%",marginBottom:14,borderRadius:12,overflow:"hidden",background:"#000",minHeight:220}}
              ref={el=>{
                if(!el||window._scannerInit) return;
                window._scannerInit=true;
                const startProdScan = () => {
                  const sc=new window.Html5Qrcode("barcode-reader");
                  window._html5QrCode=sc;
                  sc.start({facingMode:"environment"},{fps:15,qrbox:{width:280,height:100}},
                    (code)=>{
                      if(window._scanned) return;
                      window._scanned=true;
                      sc.stop().then(async ()=>{
                        window._html5QrCode=null;
                        window._scannerInit=false;
                        window._scanned=false;
                        setShowBarcodeScanner(false);
                        const currentMode = scanModeRef.current;
                        setScanMode('product');
                        if(currentMode==='cart'){
                          const found=allProductsRef.current.find(p=>p.barcode&&String(p.barcode).trim()===String(code).trim());
                          if(found){
                            addToCart(found);
                          } else {
                            // Chercher sur Open Food Facts
                            const nom = await lookupBarcode(code);
                            if(nom){
                              const confirmer = window.confirm(`Produit trouvé :\n"${nom}"\n\nVoulez-vous l'ajouter au catalogue ?`);
                              if(confirmer){
                                setEditProduct({nom,categorie:'Autres',prix:'',vrac:false,barcode:code,photo_url:''});
                                setIsNew(true);
                                setShowSettings(true);
                                setSettingsTab('produits');
                              }
                            } else {
                              alert('Code '+code+' non trouvé.\nAssociez-le dans ⚙️ → Produits');
                            }
                          }
                        } else {
                          setEditProduct(p=>({...p,barcode:code}));
                        }
                      }).catch(()=>{});
                    },
                    ()=>{})
                  .catch(e=>{alert("❌ Caméra: "+e);stopBarcodeScanner();});
                };
                if(window.Html5Qrcode){ startProdScan(); }
                else {
                  const s=document.createElement("script");
                  s.src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
                  s.onload=startProdScan;
                  document.head.appendChild(s);
                }
              }}/>
            <button style={S.btnCancel} onClick={stopBarcodeScanner}>✕ Annuler</button>
          </div>
        </div>
      )}
      {/* CART SCANNER - désactivé, utilise showBarcodeScanner en mode cart */}
      {false&&(
        <div style={{...S.overlay,zIndex:350}}>
          <div style={{...S.modal,width:420,textAlign:'center',background:'#1a1a2e'}}>
            <h2 style={{...S.mTitle,color:'#fff'}}>📷 Scanner un produit</h2>
            <p style={{color:'#aaa',fontSize:13,marginBottom:14}}>Pointez vers le code-barres</p>
            <div id="cart-barcode-reader" style={{width:'100%',marginBottom:14,borderRadius:12,overflow:'hidden',background:'#000',minHeight:220}}
              ref={el=>{
                if(!el||window._cartScannerInit) return;
                window._cartScannerInit=true;
                const startCartScan=()=>{
                  const sc=new window.Html5Qrcode('cart-barcode-reader');
                  window._cartScanner=sc;
                  sc.start({facingMode:'environment'},{fps:15,qrbox:{width:280,height:100}},
                    (code)=>{
                      if(window._cartScanned) return;
                      window._cartScanned=true;
                      const found=allProductsRef.current.find(p=>p.barcode&&String(p.barcode).trim()===String(code).trim());
                      sc.stop().then(()=>{
                        window._cartScanner=null;window._cartScannerInit=false;window._cartScanned=false;
                        setShowCartScanner(false);
                        if(found){addToCart(found);}
                        else{alert('Code non trouve - associez le barcode dans Produits');}
                      }).catch(()=>{});
                    },()=>{})
                  .catch(e=>{alert('❌ Caméra: '+e);setShowCartScanner(false);});
                };
                if(window.Html5Qrcode){startCartScan();}
                else{
                  const s=document.createElement('script');
                  s.src='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
                  s.onload=startCartScan;
                  document.head.appendChild(s);
                }
                document.head.appendChild(s);
              }}/>
            <button style={{...S.btnCancel,background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)'}} onClick={()=>{
              if(window._cartScanner){try{window._cartScanner.stop().catch(()=>{});}catch(e){}}
              window._cartScanner=null;
              window._cartScannerInit=false;
              window._cartScanned=false;
              setShowCartScanner(false);
            }}>✕ Annuler</button>
          </div>
        </div>
      )}
      {/* PIN */}
      {showPinModal&&(
        <div style={S.overlay}><div style={{...S.modal,width:320,textAlign:'center'}}>
          <div style={{fontSize:40,marginBottom:8}}>🔐</div>
          <h2 style={S.mTitle}>Code PIN requis</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k,i)=>(
              <button key={i} style={{width:'100%',height:52,fontSize:22,borderRadius:12,border:k?'1px solid #ccc':'none',background:k?'#fff':'transparent',color:'#111',fontWeight:700,cursor:'pointer',boxShadow:k?'0 2px 6px rgba(0,0,0,0.1)':'none'}}
                onClick={()=>{if(k==='⌫')setPinInput(p=>p.slice(0,-1));else if(k)setPinInput(p=>p+k);}}>
                {k}
              </button>
            ))}
          </div>
          <div style={{fontSize:28,letterSpacing:12,marginBottom:16,color:'#D3518B'}}>
            {'●'.repeat(pinInput.length)}{'○'.repeat(Math.max(0,4-pinInput.length))}
          </div>
          <div style={S.mBtns}>
            <button style={S.btnCancel} onClick={()=>{setShowPinModal(false);setPinInput('');}}>Annuler</button>
            <button style={S.btnConfirm} onClick={tryUnlock}>Valider ✓</button>
          </div>
        </div></div>
      )}
      {/* OUVRIR SESSION */}
      {showOpenSession&&(
        <div style={S.overlay}><div style={{...S.modal,width:380}}>
          <div style={{fontSize:40,textAlign:'center',marginBottom:8}}>🏦</div>
          <h2 style={S.mTitle}>Ouverture de caisse</h2>
          <p style={{color:'#888',fontSize:13,textAlign:'center',marginBottom:16}}>Entrez le fond de caisse du matin</p>
          <input style={{...S.eInput,fontSize:32,textAlign:'center',fontWeight:900,marginBottom:16,padding:'14px'}}
            type="number" step="0.01" placeholder="0,00 €" value={montantOuverture} onChange={e=>setMontantOuverture(e.target.value)} autoFocus/>
          <div style={S.mBtns}>
            <button style={S.btnCancel} onClick={()=>setShowOpenSession(false)}>Annuler</button>
            <button style={S.btnConfirm} onClick={ouvrirSession}>✅ Ouvrir la caisse</button>
          </div>
        </div></div>
      )}
      {/* FERMER SESSION */}
      {showCloseSession&&session&&(
        <div style={S.overlay}><div style={{...S.modal,width:440}}>
          <div style={{fontSize:40,textAlign:'center',marginBottom:8}}>🔒</div>
          <h2 style={S.mTitle}>Fermeture de caisse</h2>
          <div style={{background:'rgba(255,255,255,0.4)',borderRadius:12,padding:14,marginBottom:16,fontSize:13}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <span style={{color:'#111'}}>💶 Fond d'ouverture</span>
              <span style={{fontWeight:900,color:'#111'}}>{parseFloat(session.montant_ouverture||0).toFixed(2)}€</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <span style={{color:'#222'}}>💵 Ventes espèces</span>
              <span style={{fontWeight:800,color:'#1a5c3a'}}>{closingData.loaded?`+${closingData.especes.toFixed(2)}€`:'⏳ chargement...'}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <span style={{color:'#222'}}>💳 Ventes carte</span>
              <span style={{fontWeight:800,color:'#8b1a4a'}}>{closingData.loaded?`+${closingData.carte.toFixed(2)}€`:'⏳'}</span>
            </div>
            <div style={{borderTop:'1px solid rgba(0,0,0,0.15)',paddingTop:10,display:'flex',justifyContent:'space-between'}}>
              <span style={{color:'#111',fontWeight:800}}>💰 Montant attendu en caisse</span>
              <span style={{fontWeight:900,color:'#1a5c3a',fontSize:18}}>
              </span>
            </div>
          </div>
          <label style={{fontSize:13,color:'#111',fontWeight:700,display:'block',marginBottom:8}}>💶 Montant compté en caisse</label>
          <input style={{...S.eInput,fontSize:28,textAlign:'center',fontWeight:900,marginBottom:12,padding:'14px'}}
            type="number" step="0.01" placeholder="0,00" value={montantFermeture} onChange={e=>setMontantFermeture(e.target.value)} autoFocus/>
          {montantFermeture&&closingData.loaded&&(
            <div style={{marginBottom:12,padding:'8px 14px',borderRadius:10,
              background:Math.abs(parseFloat(montantFermeture)-(parseFloat(session.montant_ouverture||0)+closingData.especes))>0.01?'rgba(255,100,0,0.1)':'rgba(76,175,80,0.1)',
              border:`1px solid ${Math.abs(parseFloat(montantFermeture)-(parseFloat(session.montant_ouverture||0)+closingData.especes))>0.01?'rgba(255,100,0,0.3)':'rgba(76,175,80,0.3)'}`,
              fontSize:13,textAlign:'center',fontWeight:700,color:Math.abs(parseFloat(montantFermeture)-(parseFloat(session.montant_ouverture||0)+closingData.especes))>0.01?'#b35000':'#1a5c3a'}}>
              {Math.abs(parseFloat(montantFermeture)-(parseFloat(session.montant_ouverture||0)+closingData.especes))<=0.01
                ?'✅ Comptes JUSTES !'
                :`⚠️ Écart: ${(parseFloat(montantFermeture)-(parseFloat(session.montant_ouverture||0)+closingData.especes)).toFixed(2)}€`}
            </div>
          )}
          <label style={{fontSize:13,color:'#111',fontWeight:700,display:'block',marginBottom:7}}>
            📝 Note justificative <span style={{color:C1}}>(OBLIGATOIRE si écart)</span>
          </label>
          <textarea style={{...S.eInput,minHeight:70,resize:'vertical',marginBottom:16}}
            placeholder="Ex: Achat fournitures 50€, monnaie rendue..." value={noteEcart} onChange={e=>setNoteEcart(e.target.value)}/>
          <div style={S.mBtns}>
            <button style={S.btnCancel} onClick={()=>setShowCloseSession(false)}>Annuler</button>
            <button style={S.btnConfirm} onClick={()=>fermerSession()}>🔒 Fermer la caisse</button>
          </div>
        </div></div>
      )}
      {/* Douchette: géré via searchRef ci-dessus */}
      {/* EXPORT MODAL */}
      {showExportModal&&(
        <div style={S.overlay}>
          <div style={{...S.modal,width:480}} className="settings-content">
            <h2 style={{...S.mTitle,color:'#111'}}>📥 Exporter les ventes</h2>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:'#555',marginBottom:8}}>📅 Période</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[['daily','Journalier (auj.)'],['monthly','Mensuel (ce mois)'],['quarterly','Trimestriel'],['custom','Personnalise']].map(([v,l])=>(
                  <label key={v} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:8,border:`2px solid ${exportPeriodType===v?'#D3518B':'#ddd'}`,cursor:'pointer',background:exportPeriodType===v?'#fff0f6':'#fafafa',fontSize:13}}>
                    <input type="radio" name="period" value={v} checked={exportPeriodType===v} onChange={()=>setExportPeriodType(v)} style={{accentColor:'#D3518B'}}/>
                    {l}
                  </label>
                ))}
              </div>
              {exportPeriodType==='custom'&&(
                <div style={{display:'flex',gap:8,alignItems:'center',marginTop:10}}>
                  <span style={{fontSize:12,color:'#555'}}>Du</span>
                  <input type="date" style={{...S.eInput,flex:1,padding:'6px 10px'}} value={exportDateFrom} onChange={e=>setExportDateFrom(e.target.value)}/>
                  <span style={{fontSize:12,color:'#555'}}>au</span>
                  <input type="date" style={{...S.eInput,flex:1,padding:'6px 10px'}} value={exportDateTo} onChange={e=>setExportDateTo(e.target.value)}/>
                </div>
              )}
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:'#555',marginBottom:8}}>📊 Niveau de détail</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {[['global','Vue globale — récap par jour (pour comptable)'],['detail','Vue détaillée — chaque vente (toutes les transactions)'],['client','Par client — dépenses par client fidélité']].map(([v,l])=>(
                  <label key={v} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:8,border:`2px solid ${exportDetailLevel===v?'#D3518B':'#ddd'}`,cursor:'pointer',background:exportDetailLevel===v?'#fff0f6':'#fafafa',fontSize:13}}>
                    <input type="radio" name="detail" value={v} checked={exportDetailLevel===v} onChange={()=>setExportDetailLevel(v)} style={{accentColor:'#D3518B'}}/>
                    {l}
                  </label>
                ))}
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:13,fontWeight:700,color:'#555',marginBottom:8}}>📄 Format</div>
              <div style={{display:'flex',gap:8}}>
                {[['pdf','📄 PDF'],['csv','📊 CSV'],['both','📄+📊 Les deux']].map(([v,l])=>(
                  <label key={v} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:8,border:`2px solid ${exportFormat===v?'#D3518B':'#ddd'}`,cursor:'pointer',background:exportFormat===v?'#fff0f6':'#fafafa',fontSize:13,flex:1,justifyContent:'center'}}>
                    <input type="radio" name="format" value={v} checked={exportFormat===v} onChange={()=>setExportFormat(v)} style={{accentColor:'#D3518B'}}/>
                    {l}
                  </label>
                ))}
              </div>
            </div>
            <div style={S.mBtns}>
              <button style={S.btnCancel} onClick={()=>setShowExportModal(false)}>Annuler</button>
              <button style={S.btnConfirm} onClick={runExport}>📥 Générer l'export</button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Nunito',sans-serif;background:#78B7A0;color:#111;height:100dvh;overflow:hidden}
        button:disabled{opacity:0.4;cursor:not-allowed}
        /* Settings - texte noir */
        .settings-content, .settings-content * { color: #111 !important; }
        .settings-content input, .settings-content textarea, .settings-content select { background: #fff !important; border: 1px solid #ddd !important; color: #111 !important; }
        .settings-content .keep-white { color: #fff !important; }
        button:active{transform:scale(0.97)}
        select option{background:#14142a;color:#fff}
        input::placeholder{color:rgba(255,255,255,0.4)}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(211,81,139,0.3);border-radius:4px}
        @media print{body *{visibility:hidden}#receipt,#receipt *{visibility:visible}#receipt{position:fixed;left:0;top:0;background:white;color:black;padding:20px}}
        @media (max-height: 700px){
          .cart-footer{padding:6px 8px !important;gap:4px !important;}
          .cart-footer button{padding:7px 4px !important;font-size:12px !important;}
        }
        @media (max-width: 768px){
          .right-panel{width:260px !important;min-width:240px !important;}
        }
      `}</style>
    </div>
  );
}
const S = {
  app:{display:'flex',flexDirection:'column',height:'100dvh',background:'#78B7A0',color:'#fff',fontFamily:"'Nunito',sans-serif",overflow:'hidden'},
  header:{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',background:'linear-gradient(135deg,#D3518B 0%,#a03568 50%,#3d7a63 100%)',boxShadow:'0 4px 20px rgba(0,0,0,0.3)',flexShrink:0},
  logo:{fontSize:20,fontWeight:900,color:'#fff',whiteSpace:'nowrap',textShadow:'0 2px 6px rgba(0,0,0,0.3)'},
  hRight:{display:'flex',gap:8,alignItems:'center',flexShrink:0},
  searchInput:{width:'100%',padding:'9px 16px',borderRadius:12,border:'2px solid rgba(255,255,255,0.3)',background:'rgba(255,255,255,0.2)',color:'#fff',fontSize:14,fontFamily:"'Nunito',sans-serif",fontWeight:600,outline:'none'},
  barcodeInput:{display:'none'},
  btnW:{padding:'8px 14px',borderRadius:10,border:'none',background:'rgba(255,255,255,0.95)',color:'#D3518B',fontWeight:800,fontSize:14,cursor:'pointer'},
  btnD:{padding:'8px 14px',borderRadius:10,border:'2px solid rgba(255,255,255,0.3)',background:'rgba(255,255,255,0.15)',color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer'},
  main:{display:'flex',flex:1,overflow:'hidden',minHeight:0},
  left:{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0},
  catBar:{display:'flex',gap:6,padding:'8px 12px',overflowX:'auto',flexShrink:0,background:'rgba(0,0,0,0.1)',borderBottom:'1px solid rgba(255,255,255,0.15)',scrollbarWidth:'none'},
  catBtn:{padding:'6px 14px',borderRadius:20,border:'none',background:'rgba(255,255,255,0.2)',color:'#fff',fontWeight:700,fontSize:11,cursor:'pointer',whiteSpace:'nowrap'},
  catActive:{background:'linear-gradient(135deg,#D3518B,#a03568)',color:'#fff',boxShadow:'0 3px 12px rgba(211,81,139,0.4)'},
  grid:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:8,padding:10,overflowY:'auto',flex:1,alignContent:'start'},
  card:{background:'rgba(255,255,255,0.25)',border:'1px solid rgba(255,255,255,0.4)',borderRadius:14,padding:'12px 8px 8px',cursor:'pointer',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:4,boxShadow:'0 2px 8px rgba(0,0,0,0.15)',transition:'all 0.15s'},
  cardVrac:{background:'rgba(211,81,139,0.3)',border:'1px solid rgba(211,81,139,0.5)'},
  cardImg:{width:54,height:54,objectFit:'cover',borderRadius:10,marginBottom:2},
  cardName:{fontSize:11,fontWeight:700,color:'#fff',lineHeight:1.2,maxHeight:28,overflow:'hidden',textShadow:'0 1px 3px rgba(0,0,0,0.4)'},
  cardPrice:{fontSize:13,fontWeight:900,color:'#fff',textShadow:'0 1px 4px rgba(0,0,0,0.4)'},
  right:{width:300,minWidth:280,background:'rgba(0,0,0,0.2)',borderLeft:'1px solid rgba(255,255,255,0.2)',display:'flex',flexDirection:'column',overflow:'hidden',height:'100%'},
  cartHead:{padding:'12px 14px',fontWeight:900,fontSize:15,background:'rgba(0,0,0,0.15)',borderBottom:'1px solid rgba(255,255,255,0.15)',flexShrink:0,color:'#fff'},
  loyCard:{background:'rgba(211,81,139,0.2)',border:'1px solid rgba(211,81,139,0.4)',borderRadius:10,padding:'8px 12px',marginTop:8},
  btnX:{background:'transparent',border:'none',color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:16,fontWeight:700},
  cogBtn:{flex:1,padding:'6px 8px',borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.1)',color:'#fff',fontWeight:700,fontSize:11,cursor:'pointer'},
  cogOn:{background:'linear-gradient(135deg,#D3518B,#78B7A0)',color:'#fff',border:'none'},
  cogOff:{background:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.6)'},
  emailBtn:{width:'100%',marginTop:6,padding:'5px',borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'transparent',color:'rgba(255,255,255,0.8)',fontWeight:700,fontSize:11,cursor:'pointer'},
  items:{flex:'1 1 0',overflowY:'auto',padding:'8px 10px',display:'flex',flexDirection:'column',gap:6,minHeight:0},
  empty:{color:'rgba(255,255,255,0.4)',textAlign:'center',padding:30,fontSize:14},
  item:{background:'rgba(255,255,255,0.2)',borderRadius:10,padding:'8px 10px',display:'flex',flexDirection:'column',gap:4,border:'1px solid rgba(255,255,255,0.3)'},
  iName:{fontSize:12,fontWeight:700,color:'#fff'},
  iRow:{display:'flex',alignItems:'center',gap:6},
  qBtn:{width:26,height:26,borderRadius:8,border:'none',background:'rgba(255,255,255,0.3)',color:'#fff',fontWeight:900,cursor:'pointer',fontSize:16},
  qNum:{fontSize:14,fontWeight:800,minWidth:20,textAlign:'center',color:'#fff'},
  xBtn:{width:22,height:22,borderRadius:6,border:'none',background:'rgba(255,50,50,0.3)',color:'#fff',fontWeight:700,cursor:'pointer',fontSize:11},
  footer:{padding:'6px 8px',borderTop:'1px solid rgba(255,255,255,0.2)',display:'flex',flexDirection:'column',gap:4,flexShrink:0,background:'rgba(0,0,0,0.15)'},
  discRow:{display:'flex',justifyContent:'space-between',fontSize:12,color:'#fff',fontWeight:700,padding:'2px 0'},
  totalRow:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0'},
  totalAmt:{fontSize:20,fontWeight:900,color:'#fff',letterSpacing:'-1px',textShadow:'0 2px 8px rgba(0,0,0,0.3)'},
  tvaRow:{display:'flex',justifyContent:'space-between',fontSize:9,color:'rgba(255,255,255,0.6)'},
  payBtn:{flex:1,padding:'9px 4px',borderRadius:10,border:'none',fontWeight:900,fontSize:13,cursor:'pointer'},
  payCard:{background:'linear-gradient(135deg,#D3518B,#a03568)',color:'#fff',boxShadow:'0 4px 15px rgba(211,81,139,0.4)'},
  payCash:{background:'linear-gradient(135deg,#2e7d32,#1b5e20)',color:'#fff',boxShadow:'0 4px 15px rgba(46,125,50,0.4)'},
  remiseBtn:{flex:1,padding:'6px',borderRadius:8,border:'1px solid rgba(255,165,0,0.4)',background:'rgba(255,165,0,0.15)',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer'},
  clearRemise:{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,50,50,0.3)',background:'rgba(255,50,50,0.15)',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer'},
  clearBtn:{padding:'5px 8px',borderRadius:8,border:'1px solid rgba(255,50,50,0.3)',background:'rgba(255,50,50,0.1)',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer'},
  settingsOverlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)'},
  settingsPanel:{width:'95%',maxWidth:780,background:'#fff',display:'flex',flexDirection:'column',height:'92vh',borderRadius:16,overflow:'hidden',border:'1px solid #ddd',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'},
  settingsHead:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',background:'linear-gradient(135deg,#D3518B,#a03568,#3d7a63,#78B7A0)',flexShrink:0},
  tabBtn:{padding:'6px 12px',borderRadius:8,border:'2px solid rgba(255,255,255,0.4)',background:'rgba(255,255,255,0.15)',color:'#fff',fontWeight:700,fontSize:11,cursor:'pointer'},
  tabActive:{background:'#fff',color:'#D3518B',border:'2px solid transparent',fontWeight:900},
  settingsClose:{padding:'6px 12px',borderRadius:8,border:'none',background:'rgba(0,0,0,0.2)',color:'#fff',fontWeight:700,cursor:'pointer',fontSize:15},
  btnAdd:{padding:'6px 14px',borderRadius:8,border:'none',background:'#fff',color:'#D3518B',fontWeight:800,cursor:'pointer',fontSize:13},
  settingsSearch:{margin:'10px 14px 6px',padding:'9px 14px',borderRadius:10,border:'1px solid #ddd',background:'#f8f8f8',color:'#111',fontSize:13,outline:'none',flexShrink:0},
  settingsList:{flex:1,overflowY:'auto',padding:'4px 12px 12px'},
  sItem:{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,marginBottom:5,background:'#f8f9fa',border:'1px solid #e9ecef'},
  sThumb:{width:42,height:42,objectFit:'cover',borderRadius:8,flexShrink:0},
  editBtn:{padding:'5px 10px',borderRadius:7,border:'none',background:'#e3f2fd',color:'#1565c0',fontWeight:700,cursor:'pointer',fontSize:13},
  delBtn:{padding:'5px 9px',borderRadius:7,border:'none',background:'#ffebee',color:'#c62828',fontWeight:700,cursor:'pointer',fontSize:13},
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,backdropFilter:'blur(8px)'},
  modal:{background:'#fff',borderRadius:16,padding:24,width:430,maxWidth:'95vw',boxShadow:'0 20px 60px rgba(0,0,0,0.4)',border:'1px solid #e0e0e0'},
  mTitle:{fontSize:20,fontWeight:900,marginBottom:16,textAlign:'center',color:'#111'},
  mBtns:{display:'flex',gap:10},
  btnCancel:{flex:1,padding:11,borderRadius:10,border:'1px solid #ddd',background:'#f5f5f5',color:'#555',fontWeight:700,cursor:'pointer',fontSize:14},
  btnConfirm:{flex:1,padding:11,borderRadius:10,border:'none',background:'linear-gradient(135deg,#D3518B,#78B7A0)',color:'#fff',fontWeight:800,cursor:'pointer',fontSize:14,boxShadow:'0 3px 12px rgba(211,81,139,0.3)'},
  eGrid:{display:'grid',gridTemplateColumns:'90px 1fr',gap:'10px 12px',marginBottom:16,alignItems:'start'},
  eLabel:{fontSize:13,color:'#555',fontWeight:700,textAlign:'right',paddingTop:9},
  eInput:{padding:'9px 12px',borderRadius:8,border:'1px solid #ddd',background:'#fafafa',color:'#111',fontSize:14,outline:'none',width:'100%'},
  uploadBtn:{display:'inline-block',padding:'9px 14px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#D3518B,#78B7A0)',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',textAlign:'center'},
};
