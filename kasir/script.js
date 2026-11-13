const STORAGE_KEY = "kasirkita-data-v1";
const seedProducts = [
    { id: "p-1", name: "Kopi Susu Gula Aren", category: "Minuman", price: 18000, stock: 24, emoji: "☕", color: "#f6eee7" },
    { id: "p-2", name: "Matcha Latte", category: "Minuman", price: 22000, stock: 16, emoji: "🍵", color: "#eef5e9" },
    { id: "p-3", name: "Es Cokelat", category: "Minuman", price: 20000, stock: 8, emoji: "🥤", color: "#f8ede7" },
    { id: "p-4", name: "Croissant Butter", category: "Makanan", price: 16000, stock: 12, emoji: "🥐", color: "#fbf3e5" },
    { id: "p-5", name: "Roti Cokelat", category: "Makanan", price: 14000, stock: 4, emoji: "🥯", color: "#f8eee9" },
    { id: "p-6", name: "Donat Gula", category: "Makanan", price: 12000, stock: 18, emoji: "🍩", color: "#fff0ed" },
    { id: "p-7", name: "Air Mineral", category: "Minuman", price: 6000, stock: 30, emoji: "💧", color: "#eaf5fc" },
    { id: "p-8", name: "Kentang Goreng", category: "Camilan", price: 15000, stock: 3, emoji: "🍟", color: "#fff5e3" },
    { id: "p-9", name: "Cookies Cokelat", category: "Camilan", price: 10000, stock: 20, emoji: "🍪", color: "#f7eee7" }
];

const money = amount => new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(amount);
const dateTime = value => new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium", timeStyle: "short"
}).format(new Date(value));
const localDateKey = value => {
    const date = new Date(value);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
};
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const makeId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function loadData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return { products: seedProducts.map(product => ({ ...product })), transactions: [] };
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed.products) || !Array.isArray(parsed.transactions)) throw new Error("Format data tidak sesuai.");
        return parsed;
    } catch (error) {
        console.error("Data kasir tidak dapat dibaca:", error);
        showToast("Data lokal tidak dapat dibaca. Produk contoh dimuat sementara.", true);
        return { products: seedProducts.map(product => ({ ...product })), transactions: [] };
    }
}

let data = loadData();
let cart = [];
let currentCategory = "Semua";
let paymentMethod = "Tunai";
let toastTimer;
const $ = selector => document.querySelector(selector);
const modalBackdrop = $("#modal-backdrop");
const modal = $("#modal");

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error("Data kasir tidak dapat disimpan:", error);
        showToast("Penyimpanan browser penuh atau tidak tersedia. Perubahan belum tersimpan.", true);
        return false;
    }
}

function showToast(message, isError = false) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function renderAll() {
    renderStats();
    renderCategories();
    renderProducts();
    renderCart();
    renderInventory();
    renderHistory();
}

function renderStats() {
    const todayTransactions = data.transactions.filter(transaction => localDateKey(transaction.date) === localDateKey(new Date()));
    const sales = todayTransactions.reduce((sum, transaction) => sum + transaction.total, 0);
    const lowStock = data.products.filter(product => product.stock <= 5).length;
    $("#stat-sales").textContent = money(sales);
    $("#stat-transactions").textContent = todayTransactions.length;
    $("#stat-products").textContent = data.products.length;
    $("#stat-low-stock").textContent = lowStock;
    $("#stat-sales-note").textContent = todayTransactions.length ? `${todayTransactions.length} transaksi berhasil` : "Belum ada transaksi hari ini";
    $("#today-label").textContent = new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(new Date());
}

function renderCategories() {
    const categories = ["Semua", ...new Set(data.products.map(product => product.category).filter(Boolean))];
    if (!categories.includes(currentCategory)) currentCategory = "Semua";
    $("#category-list").innerHTML = categories.map(category =>
        `<button class="category-chip ${category === currentCategory ? "active" : ""}" data-category="${escapeHTML(category)}">${escapeHTML(category)}</button>`
    ).join("");
}

function renderProducts() {
    const query = $("#product-search").value.trim().toLocaleLowerCase("id");
    const products = data.products.filter(product =>
        (currentCategory === "Semua" || product.category === currentCategory) &&
        product.name.toLocaleLowerCase("id").includes(query)
    );
    $("#product-grid").innerHTML = products.map(product => `
        <article class="product-card ${product.stock === 0 ? "out-of-stock" : ""}" data-product-id="${escapeHTML(product.id)}" tabindex="${product.stock ? "0" : "-1"}" aria-label="Tambah ${escapeHTML(product.name)} ke keranjang">
            <span class="add-indicator">＋</span>
            <div class="product-visual" style="--product-bg:${escapeHTML(product.color || "#f1f1ff")}">${escapeHTML(product.emoji || "📦")}</div>
            <div class="product-info"><span class="product-category">${escapeHTML(product.category)}</span><strong>${escapeHTML(product.name)}</strong>
                <div class="product-info-bottom"><span class="product-price">${money(product.price)}</span><span class="product-stock ${product.stock <= 5 ? "low" : ""}">${product.stock ? `Stok ${product.stock}` : "Habis"}</span></div>
            </div>
        </article>`).join("");
    $("#empty-products").classList.toggle("hidden", products.length > 0);
}

function cartTotals() {
    const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
    return { subtotal, total: subtotal };
}

function renderCart() {
    const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
    const { subtotal, total } = cartTotals();
    $("#cart-count").textContent = `${itemCount} item`;
    $("#cart-items").innerHTML = cart.map(line => `
        <div class="cart-line">
            <span class="cart-line-emoji">${escapeHTML(line.emoji || "📦")}</span>
            <div class="cart-line-info"><strong>${escapeHTML(line.name)}</strong><small>${money(line.price)}</small>
                <div class="quantity-control"><button data-cart-action="decrease" data-id="${escapeHTML(line.id)}" aria-label="Kurangi ${escapeHTML(line.name)}">−</button><span>${line.quantity}</span><button data-cart-action="increase" data-id="${escapeHTML(line.id)}" aria-label="Tambah ${escapeHTML(line.name)}">+</button></div>
            </div><span class="cart-line-total">${money(line.price * line.quantity)}</span>
        </div>`).join("");
    $("#cart-empty").classList.toggle("hidden", cart.length > 0);
    $("#cart-subtotal").textContent = money(subtotal);
    $("#cart-total").textContent = money(total);
    $("#checkout-button").disabled = cart.length === 0;
    $("#clear-cart").classList.toggle("hidden", cart.length === 0);
}

function renderInventory() {
    const query = $("#inventory-search").value.trim().toLocaleLowerCase("id");
    const products = data.products.filter(product => product.name.toLocaleLowerCase("id").includes(query));
    $("#inventory-count").textContent = `${products.length} produk`;
    $("#inventory-body").innerHTML = products.map(product => {
        const status = product.stock === 0 ? "Habis" : product.stock <= 5 ? "Menipis" : "Tersedia";
        const statusClass = product.stock === 0 ? "empty" : product.stock <= 5 ? "low" : "";
        return `<tr><td><div class="table-product"><span class="table-emoji">${escapeHTML(product.emoji || "📦")}</span><span><strong>${escapeHTML(product.name)}</strong><small>ID: ${escapeHTML(product.id.slice(0, 12))}</small></span></div></td><td>${escapeHTML(product.category)}</td><td><strong>${money(product.price)}</strong></td><td>${product.stock}</td><td><span class="stock-pill ${statusClass}">${status}</span></td><td><div class="table-actions"><button class="icon-button" data-edit-product="${escapeHTML(product.id)}" aria-label="Edit ${escapeHTML(product.name)}">✎</button><button class="icon-button delete" data-delete-product="${escapeHTML(product.id)}" aria-label="Hapus ${escapeHTML(product.name)}">×</button></div></td></tr>`;
    }).join("");
    $("#empty-inventory").classList.toggle("hidden", products.length > 0);
}

function renderHistory() {
    const query = $("#history-search").value.trim().toLocaleLowerCase("id");
    const transactions = [...data.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    const filtered = transactions.filter(transaction => transaction.id.toLocaleLowerCase("id").includes(query));
    const totalSales = transactions.reduce((sum, transaction) => sum + transaction.total, 0);
    $("#history-total").textContent = transactions.length;
    $("#history-sales").textContent = money(totalSales);
    $("#history-count").textContent = `${filtered.length} transaksi`;
    $("#history-body").innerHTML = filtered.map(transaction => {
        const itemCount = transaction.items.reduce((sum, item) => sum + item.quantity, 0);
        return `<tr><td><strong>${escapeHTML(transaction.id)}</strong></td><td>${dateTime(transaction.date)}</td><td>${itemCount} item</td><td><span class="payment-pill">${escapeHTML(transaction.method)}</span></td><td><strong>${money(transaction.total)}</strong></td><td><div class="table-actions"><button class="detail-button" data-transaction-id="${escapeHTML(transaction.id)}">Detail</button></div></td></tr>`;
    }).join("");
    $("#empty-history").classList.toggle("hidden", filtered.length > 0);
}

function addToCart(productId) {
    const product = data.products.find(item => item.id === productId);
    if (!product || product.stock < 1) return;
    const line = cart.find(item => item.id === productId);
    if (line && line.quantity >= product.stock) {
        showToast("Jumlah di keranjang sudah mencapai batas stok.", true);
        return;
    }
    if (line) line.quantity += 1;
    else cart.push({ id: product.id, name: product.name, price: product.price, emoji: product.emoji, quantity: 1 });
    renderCart();
}

function updateCart(productId, delta) {
    const line = cart.find(item => item.id === productId);
    const product = data.products.find(item => item.id === productId);
    if (!line || !product) return;
    const next = line.quantity + delta;
    if (next > product.stock) {
        showToast("Jumlah melebihi stok yang tersedia.", true);
        return;
    }
    if (next < 1) cart = cart.filter(item => item.id !== productId);
    else line.quantity = next;
    renderCart();
}

function switchPage(page) {
    document.querySelectorAll(".page").forEach(section => section.classList.toggle("active", section.id === `page-${page}`));
    document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.page === page));
    const labels = { kasir: "Kasir", produk: "Produk & Stok", transaksi: "Riwayat transaksi" };
    $("#breadcrumb-current").textContent = labels[page];
}

function openModal(title, subtitle, content, wide = false) {
    modal.className = `modal${wide ? " modal-wide" : ""}`;
    modal.innerHTML = `<div class="modal-header"><div><h2 id="modal-title">${escapeHTML(title)}</h2><p>${escapeHTML(subtitle)}</p></div><button class="modal-close" data-close-modal aria-label="Tutup">×</button></div>${content}`;
    modalBackdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    const firstInput = modal.querySelector("input,select,button");
    if (firstInput) firstInput.focus();
}

function closeModal() {
    modalBackdrop.classList.add("hidden");
    document.body.style.overflow = "";
}

function openProductForm(product = null) {
    const editing = Boolean(product);
    const body = `
        <form class="modal-body" id="product-form">
            <div class="form-grid">
                <div class="form-field full"><label for="product-name">Nama produk</label><input id="product-name" name="name" required maxlength="60" placeholder="Contoh: Kopi susu" value="${escapeHTML(product?.name || "")}"></div>
                <div class="form-field"><label for="product-category">Kategori</label><input id="product-category" name="category" required maxlength="30" list="category-suggestions" placeholder="Contoh: Minuman" value="${escapeHTML(product?.category || "")}"><datalist id="category-suggestions">${[...new Set(data.products.map(item => item.category))].map(category => `<option value="${escapeHTML(category)}">`).join("")}</datalist></div>
                <div class="form-field"><label for="product-emoji">Ikon produk</label><select id="product-emoji" name="emoji">${["☕", "🥤", "🍵", "🥐", "🍩", "🍟", "🍪", "💧", "🍜", "🍰", "📦", "🧃"].map(emoji => `<option value="${emoji}" ${(product?.emoji || "📦") === emoji ? "selected" : ""}>${emoji}</option>`).join("")}</select></div>
                <div class="form-field"><label for="product-price">Harga (Rp)</label><input id="product-price" name="price" type="number" min="1" step="1" required placeholder="15000" value="${product?.price ?? ""}"></div>
                <div class="form-field"><label for="product-stock">Jumlah stok</label><input id="product-stock" name="stock" type="number" min="0" step="1" required placeholder="10" value="${product?.stock ?? ""}"></div>
                <p class="form-hint full">Produk dan stok tersimpan di browser perangkat ini.</p>
            </div>
            <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Batal</button><button type="submit" class="button button-primary">${editing ? "Simpan perubahan" : "Tambah produk"}</button></div>
        </form>`;
    openModal(editing ? "Edit produk" : "Tambah produk", editing ? "Perbarui informasi produk dan stok." : "Masukkan informasi produk baru ke katalog.", body);
    $("#product-form").addEventListener("submit", event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const name = formData.get("name").trim();
        const category = formData.get("category").trim();
        const price = Number(formData.get("price"));
        const stock = Number(formData.get("stock"));
        if (!name || !category || !Number.isSafeInteger(price) || price < 1 || !Number.isSafeInteger(stock) || stock < 0) {
            showToast("Periksa kembali nama, kategori, harga, dan stok.", true);
            return;
        }
        const previousProducts = data.products.map(item => ({ ...item }));
        const previousCart = cart.map(item => ({ ...item }));
        if (editing) {
            Object.assign(product, { name, category, price, stock, emoji: formData.get("emoji") });
            cart = cart.filter(line => {
                if (line.id !== product.id) return true;
                line.name = name;
                line.price = price;
                line.emoji = formData.get("emoji");
                if (line.quantity > stock) line.quantity = stock;
                return line.quantity > 0;
            });
        } else {
            data.products.push({ id: makeId("p"), name, category, price, stock, emoji: formData.get("emoji"), color: "#f1f1ff" });
        }
        if (!saveData()) {
            data.products = previousProducts;
            cart = previousCart;
            renderAll();
            return;
        }
        closeModal();
        renderAll();
        showToast(editing ? "Produk berhasil diperbarui." : "Produk berhasil ditambahkan.");
    });
}

function openCheckout() {
    if (!cart.length) return;
    paymentMethod = "Tunai";
    const { total } = cartTotals();
    const body = `
        <div class="modal-body">
            <div class="checkout-total"><span>Total pembayaran</span><strong>${money(total)}</strong></div>
            <div class="form-field"><label>Metode pembayaran</label>
                <div class="payment-methods">${[["Tunai", "💵"], ["Kartu", "💳"], ["QRIS", "▦"]].map(([method, icon]) => `<button class="payment-option ${method === "Tunai" ? "selected" : ""}" type="button" data-method="${method}"><span>${icon}</span>${method}</button>`).join("")}</div>
            </div>
            <div class="form-field ${paymentMethod === "Tunai" ? "" : "hidden"}" id="cash-field"><label for="cash-received">Uang diterima (Rp)</label><input id="cash-received" type="number" min="${total}" step="500" placeholder="${total}" inputmode="numeric"><div class="cash-presets"><button type="button" data-cash="${total}">Uang pas</button><button type="button" data-cash="${Math.ceil(total / 50000) * 50000}">${money(Math.ceil(total / 50000) * 50000)}</button><button type="button" data-cash="${Math.ceil(total / 100000) * 100000}">${money(Math.ceil(total / 100000) * 100000)}</button></div><div class="change-box" id="change-box"><span>Kembalian</span><strong id="change-value">${money(0)}</strong></div></div>
            <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Batal</button><button type="button" class="button button-primary" id="complete-checkout">Selesaikan transaksi</button></div>
        </div>`;
    openModal("Pembayaran", "Periksa metode dan konfirmasi pembayaran pelanggan.", body);
    const cashInput = $("#cash-received");
    const updateChange = () => {
        const received = Number(cashInput.value) || 0;
        const difference = received - total;
        $("#change-value").textContent = money(Math.max(0, difference));
        $("#change-box").classList.toggle("insufficient", paymentMethod === "Tunai" && received < total);
    };
    cashInput.addEventListener("input", updateChange);
    modal.querySelectorAll("[data-method]").forEach(button => button.addEventListener("click", () => {
        paymentMethod = button.dataset.method;
        modal.querySelectorAll("[data-method]").forEach(option => option.classList.toggle("selected", option === button));
        $("#cash-field").classList.toggle("hidden", paymentMethod !== "Tunai");
    }));
    modal.querySelectorAll("[data-cash]").forEach(button => button.addEventListener("click", () => {
        cashInput.value = button.dataset.cash;
        updateChange();
    }));
    $("#complete-checkout").addEventListener("click", () => {
        if (paymentMethod === "Tunai" && Number(cashInput.value) < total) {
            showToast("Jumlah uang diterima belum mencukupi.", true);
            cashInput.focus();
            return;
        }
        const unavailable = cart.find(line => {
            const product = data.products.find(item => item.id === line.id);
            return !product || product.stock < line.quantity;
        });
        if (unavailable) {
            showToast(`Stok ${unavailable.name} berubah. Periksa kembali keranjang.`, true);
            closeModal();
            renderAll();
            return;
        }
        const transaction = {
            id: `TRX-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
            date: new Date().toISOString(),
            method: paymentMethod,
            received: paymentMethod === "Tunai" ? Number(cashInput.value) : total,
            change: paymentMethod === "Tunai" ? Number(cashInput.value) - total : 0,
            total,
            items: cart.map(line => ({ ...line }))
        };
        const previousProducts = data.products.map(product => ({ ...product }));
        transaction.items.forEach(line => {
            const product = data.products.find(item => item.id === line.id);
            product.stock -= line.quantity;
        });
        data.transactions.push(transaction);
        const previousCart = cart.map(line => ({ ...line }));
        if (!saveData()) {
            data.products = previousProducts;
            data.transactions = data.transactions.filter(item => item.id !== transaction.id);
            cart = previousCart;
            renderAll();
            return;
        }
        cart = [];
        renderAll();
        renderReceipt(transaction);
    });
}

function renderReceipt(transaction) {
    const itemRows = transaction.items.map(item => `<div class="receipt-item"><span>${escapeHTML(item.name)} × ${item.quantity}</span><span>${money(item.price * item.quantity)}</span></div>`).join("");
    const content = `<div class="receipt">
        <div class="receipt-brand"><span class="brand-mark">K</span><h3>Studio Store</h3><p>Terima kasih sudah berbelanja!</p></div>
        <div class="receipt-meta"><span>No. transaksi <strong>${escapeHTML(transaction.id)}</strong></span><span>Waktu <strong>${dateTime(transaction.date)}</strong></span><span>Metode <strong>${escapeHTML(transaction.method)}</strong></span></div>
        <div class="receipt-items">${itemRows}</div>
        <div class="receipt-total"><div class="summary-line"><span>Subtotal</span><strong>${money(transaction.total)}</strong></div><div class="summary-line total-line"><span>Total</span><strong>${money(transaction.total)}</strong></div><div class="summary-line"><span>Dibayar</span><strong>${money(transaction.received)}</strong></div>${transaction.method === "Tunai" ? `<div class="summary-line"><span>Kembalian</span><strong>${money(transaction.change)}</strong></div>` : ""}</div>
        <p class="receipt-thanks">Simpan struk ini sebagai bukti transaksi.</p>
        <div class="receipt-actions"><button class="button button-secondary" data-close-modal>Tutup</button><button class="button button-primary" id="print-receipt">Cetak struk</button></div>
    </div>`;
    openModal("Transaksi berhasil", "Pembayaran telah tercatat dan stok diperbarui.", content, true);
    $("#print-receipt").addEventListener("click", () => window.print());
}

function openTransactionDetail(transaction) {
    if (!transaction) return;
    const rows = transaction.items.map(item => `<div class="receipt-item"><span>${escapeHTML(item.name)} × ${item.quantity}</span><span>${money(item.price * item.quantity)}</span></div>`).join("");
    const body = `<div class="receipt"><div class="receipt-meta"><span>No. transaksi <strong>${escapeHTML(transaction.id)}</strong></span><span>Waktu <strong>${dateTime(transaction.date)}</strong></span><span>Metode <strong>${escapeHTML(transaction.method)}</strong></span></div><div class="receipt-items">${rows}</div><div class="receipt-total"><div class="summary-line total-line"><span>Total</span><strong>${money(transaction.total)}</strong></div><div class="summary-line"><span>Dibayar</span><strong>${money(transaction.received)}</strong></div>${transaction.method === "Tunai" ? `<div class="summary-line"><span>Kembalian</span><strong>${money(transaction.change)}</strong></div>` : ""}</div><div class="modal-actions"><button class="button button-secondary" data-close-modal>Tutup</button></div></div>`;
    openModal("Detail transaksi", "Rincian pembayaran dan produk yang dibeli.", body, true);
}

document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => switchPage(button.dataset.page)));
$("#product-search").addEventListener("input", renderProducts);
$("#inventory-search").addEventListener("input", renderInventory);
$("#history-search").addEventListener("input", renderHistory);
$("#category-list").addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    currentCategory = button.dataset.category;
    renderCategories();
    renderProducts();
});
$("#product-grid").addEventListener("click", event => {
    const card = event.target.closest("[data-product-id]");
    if (card) addToCart(card.dataset.productId);
});
$("#product-grid").addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("[data-product-id]");
    if (card) {
        event.preventDefault();
        addToCart(card.dataset.productId);
    }
});
$("#cart-items").addEventListener("click", event => {
    const button = event.target.closest("[data-cart-action]");
    if (button) updateCart(button.dataset.id, button.dataset.cartAction === "increase" ? 1 : -1);
});
$("#clear-cart").addEventListener("click", () => {
    cart = [];
    renderCart();
});
$("#checkout-button").addEventListener("click", openCheckout);
$("#add-product-button").addEventListener("click", () => openProductForm());
$("#quick-add-product").addEventListener("click", () => openProductForm());
$("#help-button").addEventListener("click", () => showToast("Pilih produk, atur jumlah, lalu lanjutkan pembayaran untuk menyelesaikan transaksi."));
$("#inventory-body").addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-product]");
    const deleteButton = event.target.closest("[data-delete-product]");
    if (editButton) {
        const product = data.products.find(item => item.id === editButton.dataset.editProduct);
        if (product) openProductForm(product);
    }
    if (deleteButton) {
        const product = data.products.find(item => item.id === deleteButton.dataset.deleteProduct);
        if (!product) return;
        if (!window.confirm(`Hapus produk "${product.name}" dari katalog?`)) return;
        const previousProducts = data.products;
        const previousCart = cart;
        data.products = data.products.filter(item => item.id !== product.id);
        cart = cart.filter(item => item.id !== product.id);
        if (!saveData()) {
            data.products = previousProducts;
            cart = previousCart;
            renderAll();
            return;
        }
        renderAll();
        showToast("Produk berhasil dihapus.");
    }
});
$("#history-body").addEventListener("click", event => {
    const button = event.target.closest("[data-transaction-id]");
    if (button) openTransactionDetail(data.transactions.find(item => item.id === button.dataset.transactionId));
});
modalBackdrop.addEventListener("click", event => {
    if (event.target === modalBackdrop || event.target.closest("[data-close-modal]")) closeModal();
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modalBackdrop.classList.contains("hidden")) closeModal();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        $("#product-search").focus();
    }
});

renderAll();
