"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";

// ==========================================
// HELPERS
// ==========================================
function getTenantId(token: string | null) {
  if (!token) return null;
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join('')
    );
    const payload = JSON.parse(jsonPayload);
    return payload.tenant_id;
  } catch (e) {
    console.error("JWT Decode Error:", e);
    return null;
  }
}

function parseCSV(text: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && text[i + 1] === '"') {
      currentCell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i++; // Skip \r\n
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell !== "")) rows.push(currentRow);
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell !== "")) rows.push(currentRow);
  }
  return rows;
}

const formatIDR = (val: number) => "Rp " + val.toLocaleString("id-ID");

// ==========================================
// VENDORS TAB
// ==========================================
function VendorsTab({ tenantId }: { tenantId: string }) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ code: "", name: "", rate: 20, bank: "", active: true });

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("vendors").select("*").order("created_at", { ascending: false });
    if (data) setVendors(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const openModal = (v?: any) => {
    if (v) {
      setEditingId(v.id);
      setFormData({ code: v.code, name: v.name, rate: v.commission_rate_percentage, bank: v.bank_account || "", active: v.is_active });
    } else {
      setEditingId(null);
      setFormData({ code: "", name: "", rate: 20, bank: "", active: true });
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      tenant_id: tenantId,
      code: formData.code,
      name: formData.name,
      commission_rate_percentage: formData.rate,
      bank_account: formData.bank,
      is_active: formData.active,
    };

    if (editingId) {
      await supabase.from("vendors").update(payload).eq("id", editingId);
    } else {
      const { error } = await supabase.from("vendors").insert([payload]);
      if (error) return alert("Gagal menyimpan: Kode vendor mungkin duplikat.");
    }
    setModalOpen(false);
    fetchVendors();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0 }}>Daftar Vendor</h2>
        <button onClick={() => openModal()} style={{ background: "var(--color-brand-accent)", color: "#fff", border: "none", padding: "0.6rem 1.2rem", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}>+ Tambah Vendor</button>
      </div>

      {loading ? <p>Memuat...</p> : (
        <div style={{ background: "var(--color-brand-card)", borderRadius: "12px", border: "1px solid var(--color-brand-border)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead style={{ background: "var(--color-brand-surface)" }}>
              <tr>
                <th style={{ padding: "1rem" }}>Kode</th>
                <th style={{ padding: "1rem" }}>Nama</th>
                <th style={{ padding: "1rem" }}>Komisi</th>
                <th style={{ padding: "1rem" }}>Status</th>
                <th style={{ padding: "1rem", textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map(v => (
                <tr key={v.id} style={{ borderTop: "1px solid var(--color-brand-border)" }}>
                  <td style={{ padding: "1rem", fontFamily: "var(--font-mono)", color: "var(--color-brand-accent)" }}>{v.code}</td>
                  <td style={{ padding: "1rem", fontWeight: "bold" }}>{v.name}</td>
                  <td style={{ padding: "1rem" }}>{v.commission_rate_percentage}%</td>
                  <td style={{ padding: "1rem" }}>
                    <span style={{ padding: "0.2rem 0.6rem", borderRadius: "20px", fontSize: "0.8rem", background: v.is_active ? "var(--color-brand-green)" : "var(--color-brand-red)", color: "#000", fontWeight: "bold" }}>
                      {v.is_active ? "Aktif" : "Non-Aktif"}
                    </span>
                  </td>
                  <td style={{ padding: "1rem", textAlign: "right" }}>
                    <button onClick={() => openModal(v)} style={{ background: "transparent", border: "1px solid var(--color-brand-muted)", color: "var(--color-brand-text)", padding: "0.4rem 0.8rem", borderRadius: "6px", cursor: "pointer" }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <form onSubmit={handleSave} style={{ background: "var(--color-brand-card)", padding: "2rem", borderRadius: "12px", width: "100%", maxWidth: "400px" }}>
            <h3>{editingId ? "Edit Vendor" : "Tambah Vendor"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
              <input required placeholder="Kode Vendor (Unik)" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} style={{ padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", color: "#fff" }} />
              <input required placeholder="Nama Vendor" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", color: "#fff" }} />
              <input required type="number" placeholder="Komisi (%)" value={formData.rate} onChange={e => setFormData({...formData, rate: Number(e.target.value)})} style={{ padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", color: "#fff" }} />
              <input placeholder="Rekening Bank" value={formData.bank} onChange={e => setFormData({...formData, bank: e.target.value})} style={{ padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", color: "#fff" }} />
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input type="checkbox" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} />
                Vendor Aktif
              </label>
              <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                <button type="button" onClick={() => setModalOpen(false)} style={{ flex: 1, padding: "0.8rem", borderRadius: "8px", background: "transparent", border: "1px solid var(--color-brand-muted)", color: "var(--color-brand-text)", cursor: "pointer" }}>Batal</button>
                <button type="submit" style={{ flex: 1, padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-accent)", border: "none", color: "#fff", cursor: "pointer", fontWeight: "bold" }}>Simpan</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ==========================================
// DISCOUNTS TAB
// ==========================================
function DiscountsTab({ tenantId }: { tenantId: string }) {
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ code: "", desc: "", pct: 10, bearer: "vynalee", active: true });

  const fetchDiscounts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("discount_codes").select("*").order("created_at", { ascending: false });
    if (data) setDiscounts(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDiscounts(); }, [fetchDiscounts]);

  const openModal = (d?: any) => {
    if (d) {
      setEditingId(d.code);
      setFormData({ code: d.code, desc: d.description || "", pct: d.discount_percentage, bearer: d.bearer, active: d.is_active });
    } else {
      setEditingId(null);
      setFormData({ code: "", desc: "", pct: 10, bearer: "vynalee", active: true });
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      tenant_id: tenantId,
      code: formData.code.toUpperCase(),
      description: formData.desc,
      discount_percentage: formData.pct,
      bearer: formData.bearer,
      is_active: formData.active,
    };

    if (editingId) {
      await supabase.from("discount_codes").update(payload).eq("code", editingId);
    } else {
      const { error } = await supabase.from("discount_codes").insert([payload]);
      if (error) return alert("Gagal menyimpan: Kode promo mungkin duplikat.");
    }
    setModalOpen(false);
    fetchDiscounts();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0 }}>Kode Diskon</h2>
        <button onClick={() => openModal()} style={{ background: "var(--color-brand-accent)", color: "#fff", border: "none", padding: "0.6rem 1.2rem", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}>+ Tambah Diskon</button>
      </div>

      {loading ? <p>Memuat...</p> : (
        <div style={{ background: "var(--color-brand-card)", borderRadius: "12px", border: "1px solid var(--color-brand-border)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead style={{ background: "var(--color-brand-surface)" }}>
              <tr>
                <th style={{ padding: "1rem" }}>Kode</th>
                <th style={{ padding: "1rem" }}>Deskripsi</th>
                <th style={{ padding: "1rem" }}>Diskon</th>
                <th style={{ padding: "1rem" }}>Penanggung</th>
                <th style={{ padding: "1rem" }}>Status</th>
                <th style={{ padding: "1rem", textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map(d => (
                <tr key={d.code} style={{ borderTop: "1px solid var(--color-brand-border)" }}>
                  <td style={{ padding: "1rem", fontFamily: "var(--font-mono)", color: "var(--color-brand-accent)", fontWeight: "bold" }}>{d.code}</td>
                  <td style={{ padding: "1rem" }}>{d.description}</td>
                  <td style={{ padding: "1rem", color: "var(--color-brand-red)", fontWeight: "bold" }}>{d.discount_percentage}%</td>
                  <td style={{ padding: "1rem" }}>{d.bearer === "vynalee" ? "Toko (Vynalee)" : "Vendor"}</td>
                  <td style={{ padding: "1rem" }}>
                    <span style={{ padding: "0.2rem 0.6rem", borderRadius: "20px", fontSize: "0.8rem", background: d.is_active ? "var(--color-brand-green)" : "var(--color-brand-red)", color: "#000", fontWeight: "bold" }}>
                      {d.is_active ? "Aktif" : "Non-Aktif"}
                    </span>
                  </td>
                  <td style={{ padding: "1rem", textAlign: "right" }}>
                    <button onClick={() => openModal(d)} style={{ background: "transparent", border: "1px solid var(--color-brand-muted)", color: "var(--color-brand-text)", padding: "0.4rem 0.8rem", borderRadius: "6px", cursor: "pointer" }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <form onSubmit={handleSave} style={{ background: "var(--color-brand-card)", padding: "2rem", borderRadius: "12px", width: "100%", maxWidth: "400px" }}>
            <h3>{editingId ? "Edit Diskon" : "Tambah Diskon"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
              <input required placeholder="KODE (Unik)" value={formData.code} disabled={!!editingId} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} style={{ padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", color: "#fff" }} />
              <input placeholder="Deskripsi" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} style={{ padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", color: "#fff" }} />
              <input required type="number" placeholder="Diskon (%)" value={formData.pct} onChange={e => setFormData({...formData, pct: Number(e.target.value)})} style={{ padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", color: "#fff" }} />
              <select value={formData.bearer} onChange={e => setFormData({...formData, bearer: e.target.value})} style={{ padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", color: "#fff" }}>
                <option value="vynalee">Ditanggung Toko (Vynalee)</option>
                <option value="vendor">Ditanggung Vendor</option>
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input type="checkbox" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} />
                Diskon Aktif
              </label>
              <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                <button type="button" onClick={() => setModalOpen(false)} style={{ flex: 1, padding: "0.8rem", borderRadius: "8px", background: "transparent", border: "1px solid var(--color-brand-muted)", color: "var(--color-brand-text)", cursor: "pointer" }}>Batal</button>
                <button type="submit" style={{ flex: 1, padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-accent)", border: "none", color: "#fff", cursor: "pointer", fontWeight: "bold" }}>Simpan</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ==========================================
// ITEMS TAB
// ==========================================
function ItemsTab({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ id: "", name: "", category: "Lainnya", size: "", color: "", condition: "", price: 0, vendor_id: "", status: "available" });

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const ITEMS_PER_PAGE = 50;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("items").select("*, vendors(name, code)", { count: "exact" });
    if (searchQuery) {
      q = q.or(`id.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`);
    }
    const from = (page - 1) * ITEMS_PER_PAGE;
    const { data, count } = await q.range(from, from + ITEMS_PER_PAGE - 1).order("created_at", { ascending: false });
    
    if (data) setItems(data);
    if (count !== null) setTotalCount(count);
    setLoading(false);
  }, [page, searchQuery]);

  const fetchVendorsList = useCallback(async () => {
    const { data } = await supabase.from("vendors").select("id, code, name").eq("is_active", true);
    if (data) setVendorsList(data);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { fetchVendorsList(); }, [fetchVendorsList]);

  const openModal = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setFormData({ ...item });
    } else {
      setEditingId(null);
      setFormData({ id: "", name: "", category: "", size: "", color: "", condition: "", price: 0, vendor_id: vendorsList[0]?.id || "", status: "available" });
    }
    setModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      tenant_id: tenantId,
      id: formData.id,
      name: formData.name,
      category: formData.category || "Lainnya",
      size: formData.size,
      color: formData.color,
      condition: formData.condition,
      price: formData.price,
      vendor_id: formData.vendor_id || null,
      status: formData.status
    };

    if (editingId) {
      await supabase.from("items").update(payload).eq("id", editingId);
    } else {
      const { error } = await supabase.from("items").insert([payload]);
      if (error) return alert("Gagal: Barcode mungkin duplikat.");
    }
    setModalOpen(false);
    fetchItems();
  };

  const handleQuickStatus = async (id: string, newStatus: string) => {
    await supabase.from("items").update({ status: newStatus }).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
  };

  const handleBulkUpload = async () => {
    if (!csvFile) return alert("Pilih file CSV terlebih dahulu.");
    setUploading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) { setUploading(false); return alert("File kosong atau format salah."); }

      // Expect Headers: Barcode, Name, Category, Size, Color, Condition, Price, VendorCode
      const payloads = [];
      let skippedCount = 0;

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length < 8) continue; // Skip incomplete rows
        
        const vCode = r[7].trim().toUpperCase();
        const vendor = vendorsList.find(v => v.code.toUpperCase() === vCode);
        
        if (!vendor) { skippedCount++; continue; } // Skip if vendor not found

        payloads.push({
          tenant_id: tenantId,
          id: r[0].trim(),
          name: r[1].trim(),
          category: r[2].trim() || "Lainnya",
          size: r[3].trim(),
          color: r[4].trim(),
          condition: r[5].trim(),
          price: Number(r[6]) || 0,
          vendor_id: vendor.id,
          status: "available"
        });
      }

      if (payloads.length === 0) {
        setUploading(false);
        return alert("Gagal: Tidak ada baris yang valid atau kode vendor tidak ditemukan.");
      }

      // Chunk Insert (500 rows per batch)
      const CHUNK_SIZE = 500;
      let successCount = 0;
      for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
        const chunk = payloads.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from("items").insert(chunk);
        if (!error) successCount += chunk.length;
      }

      setUploading(false);
      setBulkModalOpen(false);
      alert(`Berhasil mengunggah ${successCount} item. Dilewati (Vendor tak ditemukan / Error): ${payloads.length - successCount + skippedCount}`);
      setPage(1);
      fetchItems();
    };
    reader.readAsText(csvFile);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <h2 style={{ margin: 0 }}>Inventory Database</h2>
        <div style={{ display: "flex", gap: "1rem" }}>
          <input 
            placeholder="Cari Barcode / Nama..." 
            value={searchQuery} 
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }} 
            style={{ padding: "0.6rem", borderRadius: "8px", border: "1px solid var(--color-brand-border)", background: "var(--color-brand-surface)", color: "#fff" }} 
          />
          <button onClick={() => setBulkModalOpen(true)} style={{ background: "transparent", color: "var(--color-brand-text)", border: "1px solid var(--color-brand-border)", padding: "0.6rem 1.2rem", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}>Import CSV</button>
          <button onClick={() => openModal()} style={{ background: "var(--color-brand-accent)", color: "#fff", border: "none", padding: "0.6rem 1.2rem", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}>+ Item Baru</button>
        </div>
      </div>

      {loading ? <p>Memuat inventaris...</p> : (
        <>
          <div style={{ background: "var(--color-brand-card)", borderRadius: "12px", border: "1px solid var(--color-brand-border)", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
              <thead style={{ background: "var(--color-brand-surface)" }}>
                <tr>
                  <th style={{ padding: "1rem" }}>Barcode</th>
                  <th style={{ padding: "1rem" }}>Nama Barang</th>
                  <th style={{ padding: "1rem" }}>Kategori</th>
                  <th style={{ padding: "1rem" }}>Harga</th>
                  <th style={{ padding: "1rem" }}>Vendor</th>
                  <th style={{ padding: "1rem" }}>Status</th>
                  <th style={{ padding: "1rem", textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} style={{ borderTop: "1px solid var(--color-brand-border)" }}>
                    <td style={{ padding: "1rem", fontFamily: "var(--font-mono)", color: "var(--color-brand-accent)", fontWeight: "bold" }}>{item.id}</td>
                    <td style={{ padding: "1rem" }}>{item.name}</td>
                    <td style={{ padding: "1rem", color: "var(--color-brand-muted)" }}>{item.category}</td>
                    <td style={{ padding: "1rem", fontWeight: "bold" }}>{formatIDR(item.price)}</td>
                    <td style={{ padding: "1rem" }}>{(item.vendors as any)?.name || "-"}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <select
                        value={item.status}
                        onChange={e => handleQuickStatus(item.id, e.target.value)}
                        style={{
                          padding: "0.3rem 0.5rem", borderRadius: "8px", fontSize: "0.75rem",
                          fontWeight: "bold", border: "1px solid var(--color-brand-border)",
                          background: item.status === "available" ? "rgba(16,185,129,0.15)"
                            : item.status === "sold" ? "rgba(239,68,68,0.15)"
                            : item.status === "return" ? "rgba(245,158,11,0.15)"
                            : "rgba(255,255,255,0.08)",
                          color: item.status === "available" ? "var(--color-brand-green)"
                            : item.status === "sold" ? "var(--color-brand-red)"
                            : item.status === "return" ? "var(--color-brand-yellow)"
                            : "var(--color-brand-muted)",
                          cursor: "pointer", outline: "none",
                        }}
                      >
                        <option value="available">AVAILABLE</option>
                        <option value="sold">SOLD</option>
                        <option value="return">RETURN</option>
                        <option value="in_cart">IN CART</option>
                        <option value="void">VOID</option>
                      </select>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                      <button onClick={() => openModal(item)} style={{ background: "transparent", border: "1px solid var(--color-brand-muted)", color: "var(--color-brand-text)", padding: "0.4rem 0.6rem", borderRadius: "6px", cursor: "pointer" }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem", marginTop: "1.5rem" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "0.5rem 1rem", borderRadius: "8px", cursor: page === 1 ? "not-allowed" : "pointer" }}>Prev</button>
              <span style={{ fontSize: "0.9rem" }}>Halaman {page} dari {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "0.5rem 1rem", borderRadius: "8px", cursor: page === totalPages ? "not-allowed" : "pointer" }}>Next</button>
            </div>
          )}
        </>
      )}

      {/* Item Modal */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: "1rem" }}>
          <form onSubmit={handleSaveItem} style={{ background: "var(--color-brand-card)", padding: "2rem", borderRadius: "12px", width: "100%", maxWidth: "500px", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h3>{editingId ? "Edit Item" : "Item Baru"}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <input required placeholder="Barcode (ID)" value={formData.id} disabled={!!editingId} onChange={e => setFormData({...formData, id: e.target.value})} style={{ padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", color: "#fff" }} />
              <input required placeholder="Nama Barang" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", color: "#fff" }} />
              <input placeholder="Kategori (Bebas)" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} style={{ padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", color: "#fff" }} />
              <input required type="number" placeholder="Harga (Rp)" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} style={{ padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", color: "#fff" }} />
              <select required value={formData.vendor_id} onChange={e => setFormData({...formData, vendor_id: e.target.value})} style={{ padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", color: "#fff", gridColumn: "span 2" }}>
                <option value="" disabled>Pilih Vendor...</option>
                {vendorsList.map(v => <option key={v.id} value={v.id}>{v.name} ({v.code})</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
              <button type="button" onClick={() => setModalOpen(false)} style={{ flex: 1, padding: "0.8rem", borderRadius: "8px", background: "transparent", border: "1px solid var(--color-brand-muted)", color: "var(--color-brand-text)", cursor: "pointer" }}>Batal</button>
              <button type="submit" style={{ flex: 1, padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-accent)", border: "none", color: "#fff", cursor: "pointer", fontWeight: "bold" }}>Simpan</button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {bulkModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: "1rem" }}>
          <div style={{ background: "var(--color-brand-card)", padding: "2.5rem", borderRadius: "12px", width: "100%", maxWidth: "450px" }}>
            <h3 style={{ margin: "0 0 1rem 0" }}>Import CSV Bulk</h3>
            <p style={{ fontSize: "0.9rem", color: "var(--color-brand-muted)", marginBottom: "1.5rem", lineHeight: "1.5" }}>
              Format Kolom Wajib (tanpa spasi di Header):<br/>
              <code style={{ color: "var(--color-brand-accent)", wordBreak: "break-all" }}>Barcode,Name,Category,Size,Color,Condition,Price,VendorCode</code><br/>
              <br/>*Pastikan VendorCode sama persis dengan yang ada di sistem (contoh: V01).
            </p>
            <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} style={{ marginBottom: "1.5rem", width: "100%" }} />
            <div style={{ display: "flex", gap: "1rem" }}>
              <button onClick={() => setBulkModalOpen(false)} disabled={uploading} style={{ flex: 1, padding: "0.8rem", borderRadius: "8px", background: "transparent", border: "1px solid var(--color-brand-border)", color: "#fff", cursor: "pointer" }}>Batal</button>
              <button onClick={handleBulkUpload} disabled={uploading} style={{ flex: 1, padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-green)", border: "none", color: "#000", fontWeight: "bold", cursor: uploading ? "not-allowed" : "pointer" }}>
                {uploading ? "Mengimpor..." : "Mulai Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ==========================================
// MAIN DASHBOARD COMPONENT
// ==========================================
function MasterDataContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"items" | "vendors" | "discounts">("items");
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "items" || tab === "vendors" || tab === "discounts") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    if (user.role !== "owner" && user.role !== "admin") { router.replace("/kasir"); return; }
    
    const tId = getTenantId(token);
    if (tId) setTenantId(tId);
  }, [user, router, token]);

  if (!user || !tenantId) return <div style={{ minHeight: "100vh", background: "var(--color-brand-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-brand-muted)" }}>Menginisialisasi sesi aman...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-brand-bg)", padding: "2rem", fontFamily: "var(--font-sans)", color: "var(--color-brand-text)" }}>
      <header style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "2.5rem", fontWeight: "900", margin: 0, letterSpacing: "-1px" }}>Master Data</h1>
          <p style={{ color: "var(--color-brand-muted)", margin: "0.5rem 0 0 0", fontSize: "1rem" }}>Manajemen Inventaris, Vendor & Diskon</p>
        </div>
        <button onClick={() => router.push("/kasir")} style={{ background: "transparent", color: "var(--color-brand-accent)", border: "1px solid var(--color-brand-accent)", padding: "0.6rem 1.2rem", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}>
          ← Kembali ke Kasir
        </button>
      </header>

      {/* Tabs Navigation */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", borderBottom: "1px solid var(--color-brand-border)", overflowX: "auto" }}>
        <button onClick={() => setActiveTab("items")} style={{ background: "transparent", border: "none", borderBottom: activeTab === "items" ? "3px solid var(--color-brand-accent)" : "3px solid transparent", color: activeTab === "items" ? "var(--color-brand-text)" : "var(--color-brand-muted)", padding: "1rem", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", transition: "all 0.2s" }}>
          Barang / Inventory
        </button>
        <button onClick={() => setActiveTab("vendors")} style={{ background: "transparent", border: "none", borderBottom: activeTab === "vendors" ? "3px solid var(--color-brand-accent)" : "3px solid transparent", color: activeTab === "vendors" ? "var(--color-brand-text)" : "var(--color-brand-muted)", padding: "1rem", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", transition: "all 0.2s" }}>
          Daftar Vendor
        </button>
        <button onClick={() => setActiveTab("discounts")} style={{ background: "transparent", border: "none", borderBottom: activeTab === "discounts" ? "3px solid var(--color-brand-accent)" : "3px solid transparent", color: activeTab === "discounts" ? "var(--color-brand-text)" : "var(--color-brand-muted)", padding: "1rem", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", transition: "all 0.2s" }}>
          Kode Promo
        </button>
      </div>

      {/* Tab Render */}
      <div style={{ paddingBottom: "4rem" }}>
        {activeTab === "items" && <ItemsTab tenantId={tenantId} />}
        {activeTab === "vendors" && <VendorsTab tenantId={tenantId} />}
        {activeTab === "discounts" && <DiscountsTab tenantId={tenantId} />}
      </div>
    </div>
  );
}

export default function MasterDataDashboard() {
  return (
    <Suspense fallback={<div>Memuat...</div>}>
      <MasterDataContent />
    </Suspense>
  );
}
