(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const KEYS = {
    cart: "mom-cart",
    wishlist: "mom-wishlist",
    users: "mom-users",
    session: "mom-session",
    theme: "mom-theme",
  };
  const safeRead = (key, fallback) => {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v ?? fallback;
    } catch {
      return fallback;
    }
  };
  const readCart = () => safeRead(KEYS.cart, []);
  const readWishlist = () => safeRead(KEYS.wishlist, []);
  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      toast("Could not save data in this browser.");
    }
  };
  let products = [];
  let currentCategory = "all";
  let currentSearch = "";
  let toastTimer;
  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  }
  function esc(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }
  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }
  function themeMode() {
    return localStorage.getItem(KEYS.theme) || "auto";
  }
  function applyTheme(mode, save = true) {
    const dark =
      mode === "dark" ||
      (mode === "auto" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.themeMode = mode;
    const labels = { auto: "Auto", light: "Light", dark: "Dark" };
    $$(".theme-toggle").forEach((b) => {
      const icon = $("#theme-icon", b),
        label = $(".theme-label", b);
      if (icon)
        icon.textContent = mode === "auto" ? "◐" : mode === "dark" ? "☾" : "☀";
      if (label) label.textContent = labels[mode];
      b.title = `Theme: ${labels[mode]} (click to change)`;
      b.setAttribute(
        "aria-label",
        `Theme is ${labels[mode]}. Click to change.`,
      );
    });
    if (save) {
      try {
        localStorage.setItem(KEYS.theme, mode);
      } catch {}
    }
  }
  function initTheme() {
    applyTheme(themeMode(), false);
    $$(".theme-toggle").forEach((b) =>
      b.addEventListener("click", () => {
        const next = { auto: "light", light: "dark", dark: "auto" }[
          themeMode()
        ];
        applyTheme(next);
        toast(`Theme: ${next}`);
      }),
    );
    try {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", () => {
          if (themeMode() === "auto") applyTheme("auto", false);
        });
    } catch {}
  }
  function getSession() {
    return safeRead(KEYS.session, null);
  }
  function updateHeader() {
    const cartCount = readCart().reduce(
      (sum, item) => sum + Math.max(0, Number(item.qty) || 0),
      0,
    );
    const wishCount = readWishlist().length;
    $$("#cart-count").forEach((el) => (el.textContent = cartCount));
    $$("#wishlist-count").forEach((el) => (el.textContent = wishCount));
    const link = $("#account-link"),
      session = getSession();
    if (link) {
      link.textContent = session
        ? `Hi, ${String(session.name || session.email.split("@")[0]).split(" ")[0]}`
        : "Login";
      link.href = "login.html";
    }
  }
  async function loadProducts() {
    if (!$("#products-container") && !$("#product-detail-container")) return;
    try {
      const response = await fetch("https://dummyjson.com/products?limit=100");
      if (!response.ok) throw new Error("Could not fetch products");
      const data = await response.json();
      products = (data.products || []).map((p) => ({
        ...p,
        price: Number(p.price) || 0,
      }));
      try {
        localStorage.setItem("mom-products-cache", JSON.stringify(products));
      } catch {}
    } catch (err) {
      products = safeRead("mom-products-cache", []);
      if (!products.length) {
        const error = $("#load-error");
        if (error) {
          error.classList.remove("hidden");
          error.textContent =
            "Products could not load. Check your internet connection and open this page through VS Code Live Server.";
        }
      }
    }
    if ($("#products-container")) {
      renderCategories();
      renderProducts();
    }
    if ($("#product-detail-container")) renderProductDetail();
  }
  function categories() {
    return [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  }
  function renderCategories() {
    const el = $("#category-filters");
    if (!el) return;
    el.innerHTML =
      `<button class="filter-chip ${currentCategory === "all" ? "selected" : ""}" data-category="all">All products</button>` +
      categories()
        .map(
          (c) =>
            `<button class="filter-chip ${currentCategory === c ? "selected" : ""}" data-category="${esc(c)}">${esc(c.replace(/-/g, " "))}</button>`,
        )
        .join("");
    $$("button[data-category]", el).forEach((b) =>
      b.addEventListener("click", () => {
        currentCategory = b.dataset.category;
        renderCategories();
        renderProducts();
      }),
    );
  }
  function productCard(p) {
    const saved = readWishlist().some((x) => Number(x.id) === Number(p.id));
    return `<article class="product-card"><div class="product-image"><img src="${esc(p.thumbnail || p.images?.[0] || "")}" alt="${esc(p.title)}" loading="lazy" onerror="this.style.display='none'"><button class="heart ${saved ? "saved" : ""}" type="button" data-wish="${p.id}" aria-label="${saved ? "Remove from wishlist" : "Add to wishlist"}">${saved ? "♥" : "♡"}</button></div><div class="product-info"><span class="category-label">${esc(p.category || "product")}</span><h3>${esc(p.title)}</h3><div class="product-rating">★ ${Number(p.rating || 0).toFixed(1)} · ${esc(p.brand || "Everyday pick")}</div><div class="product-bottom"><span class="price">${money(p.price)}</span><button class="small-btn" data-details="${p.id}">View details</button></div><button class="btn btn-primary" data-add="${p.id}" style="margin-top:12px;padding:10px">Add to cart</button></div></article>`;
  }
  function renderProducts() {
    const el = $("#products-container");
    if (!el) return;
    const filtered = products.filter(
      (p) =>
        (currentCategory === "all" || p.category === currentCategory) &&
        `${p.title} ${p.description} ${p.category} ${p.brand || ""}`
          .toLowerCase()
          .includes(currentSearch.toLowerCase()),
    );
    $("#result-count").textContent =
      `${filtered.length} product${filtered.length === 1 ? "" : "s"}`;
    el.innerHTML = filtered.length
      ? filtered.map(productCard).join("")
      : `<div class="empty-state" style="grid-column:1/-1">No products found. Try another search or category.</div>`;
    $$("[data-add]", el).forEach((b) =>
      b.addEventListener("click", () => addToCart(Number(b.dataset.add), 1)),
    );
    $$("[data-wish]", el).forEach((b) =>
      b.addEventListener("click", () => toggleWishlist(Number(b.dataset.wish))),
    );
    $$("[data-details]", el).forEach((b) =>
      b.addEventListener(
        "click",
        () =>
          (location.href = `product-details.html?id=${encodeURIComponent(b.dataset.details)}`),
      ),
    );
  }
  function productById(id) {
    return products.find((p) => Number(p.id) === Number(id));
  }
  function addToCart(id, qty = 1) {
    const p =
      productById(id) ||
      safeRead("mom-products-cache", []).find(
        (x) => Number(x.id) === Number(id),
      );
    if (!p) {
      toast("Product is not available right now.");
      return;
    }
    const cart = readCart(),
      found = cart.find((x) => Number(x.id) === Number(id));
    if (found) found.qty = Math.min(99, (Number(found.qty) || 1) + qty);
    else
      cart.push({
        id: p.id,
        qty: Math.max(1, Math.min(99, qty)),
        title: p.title,
        price: p.price,
        thumbnail: p.thumbnail || p.images?.[0] || "",
        category: p.category || "",
      });
    write(KEYS.cart, cart);
    updateHeader();
    renderCart();
    toast("Added to cart");
  }
  function toggleWishlist(id) {
    const p =
      productById(id) ||
      safeRead("mom-products-cache", []).find(
        (x) => Number(x.id) === Number(id),
      );
    if (!p) {
      toast("Product is not available right now.");
      return;
    }
    let list = readWishlist();
    const exists = list.some((x) => Number(x.id) === Number(id));
    if (exists) list = list.filter((x) => Number(x.id) !== Number(id));
    else
      list.push({
        id: p.id,
        title: p.title,
        price: p.price,
        thumbnail: p.thumbnail || p.images?.[0] || "",
        category: p.category || "",
      });
    write(KEYS.wishlist, list);
    updateHeader();
    renderProducts();
    renderWishlist();
    toast(exists ? "Removed from wishlist" : "Saved to wishlist");
  }
  function renderCart() {
    const el = $("#cart-container");
    if (!el) return;
    const cart = readCart();
    if (!cart.length) {
      el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div style="font-size:40px">🛍</div><h2>Your cart is empty</h2><p>Find something you'll love.</p><a class="btn btn-primary" href="index.html">Start shopping →</a></div>`;
      return;
    }
    const subtotal = cart.reduce(
        (s, p) => s + (Number(p.price) || 0) * (Number(p.qty) || 1),
        0,
      ),
      shipping = subtotal >= 999 ? 0 : 49,
      total = subtotal + shipping;
    el.innerHTML = `<section class="list-panel">${cart.map((p) => `<article class="cart-row"><a class="row-image" href="product-details.html?id=${p.id}"><img src="${esc(p.thumbnail)}" alt="${esc(p.title)}" onerror="this.style.display='none'"></a><div class="row-info"><h3><a href="product-details.html?id=${p.id}">${esc(p.title)}</a></h3><p>${esc(p.category || "Product")} · ${money(p.price)} each</p></div><div class="row-actions"><div class="qty-control"><button type="button" data-qty="-1" data-id="${p.id}" aria-label="Decrease quantity">−</button><span>${Number(p.qty) || 1}</span><button type="button" data-qty="1" data-id="${p.id}" aria-label="Increase quantity">+</button></div><span class="row-price">${money((Number(p.price) || 0) * (Number(p.qty) || 1))}</span><button class="icon-btn" data-remove-cart="${p.id}">Remove</button></div></article>`).join("")}</section><aside class="summary-card"><h2>Order summary</h2><div class="summary-line"><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div class="summary-line"><span>Shipping</span><strong>${shipping === 0 ? "Free" : money(shipping)}</strong></div>${subtotal < 999 ? `<p class="fine-print">Free shipping on orders of ₹999 or more.</p>` : ""}<div class="summary-line total"><span>Total</span><strong>${money(total)}</strong></div><button class="btn btn-primary" id="checkout-btn">Continue to checkout →</button><p class="fine-print">Demo checkout only. No payment will be taken.</p><a class="btn btn-secondary" href="index.html">Continue shopping</a></aside>`;
    $$("[data-qty]", el).forEach((b) =>
      b.addEventListener("click", () =>
        changeQty(Number(b.dataset.id), Number(b.dataset.qty)),
      ),
    );
    $$("[data-remove-cart]", el).forEach((b) =>
      b.addEventListener("click", () => {
        write(
          KEYS.cart,
          readCart().filter(
            (p) => Number(p.id) !== Number(b.dataset.removeCart),
          ),
        );
        updateHeader();
        renderCart();
        toast("Item removed");
      }),
    );
    $("#checkout-btn")?.addEventListener("click", () => {
      if (!getSession()) {
        toast("Please log in to continue");
        setTimeout(() => (location.href = "login.html?next=cart.html"), 650);
      } else toast("Demo checkout: payment is not configured.");
    });
  }
  function changeQty(id, delta) {
    let cart = readCart();
    const p = cart.find((x) => Number(x.id) === id);
    if (!p) return;
    p.qty = (Number(p.qty) || 1) + delta;
    if (p.qty < 1) cart = cart.filter((x) => Number(x.id) !== id);
    else p.qty = Math.min(99, p.qty);
    write(KEYS.cart, cart);
    updateHeader();
    renderCart();
  }
  function renderWishlist() {
    const el = $("#wishlist-container");
    if (!el) return;
    const list = readWishlist();
    if (!list.length) {
      el.innerHTML = `<div class="empty-state"><div style="font-size:40px">♡</div><h2>Your wishlist is empty</h2><p>Tap the heart on any product to save it here.</p><a class="btn btn-primary" href="index.html">Explore products →</a></div>`;
      return;
    }
    el.innerHTML = list
      .map(
        (p) =>
          `<article class="wishlist-row"><a class="row-image" href="product-details.html?id=${p.id}"><img src="${esc(p.thumbnail)}" alt="${esc(p.title)}" onerror="this.style.display='none'"></a><div class="row-info"><h3><a href="product-details.html?id=${p.id}">${esc(p.title)}</a></h3><p>${esc(p.category || "Product")}</p><div class="row-price" style="margin-top:7px">${money(p.price)}</div></div><div class="row-actions"><button class="btn btn-primary" data-wish-add="${p.id}">Add to cart</button><button class="icon-btn" data-wish-remove="${p.id}">Remove</button></div></article>`,
      )
      .join("");
    $$("[data-wish-add]", el).forEach((b) =>
      b.addEventListener("click", () =>
        addToCart(Number(b.dataset.wishAdd), 1),
      ),
    );
    $$("[data-wish-remove]", el).forEach((b) =>
      b.addEventListener("click", () => {
        write(
          KEYS.wishlist,
          readWishlist().filter(
            (p) => Number(p.id) !== Number(b.dataset.wishRemove),
          ),
        );
        updateHeader();
        renderWishlist();
        renderProducts();
        toast("Removed from wishlist");
      }),
    );
  }
  function renderProductDetail() {
    const el = $("#product-detail-container");
    if (!el) return;
    const id = new URLSearchParams(location.search).get("id") || "1",
      p =
        productById(id) ||
        safeRead("mom-products-cache", []).find(
          (x) => Number(x.id) === Number(id),
        );
    if (!p) {
      el.innerHTML = `<div class="empty-state"><h2>Product not found</h2><a class="btn btn-primary" href="index.html">Back to shop</a></div>`;
      return;
    }
    document.title = `${p.title} — My Official Mart`;
    const saved = readWishlist().some((x) => Number(x.id) === Number(p.id));
    el.innerHTML = `<div class="detail-layout"><div class="detail-image"><img src="${esc(p.images?.[0] || p.thumbnail)}" alt="${esc(p.title)}" onerror="this.src='${esc(p.thumbnail || "")}'"></div><section class="detail-info"><span class="category-label">${esc(p.category || "Product")}</span><h1>${esc(p.title)}</h1><p class="product-rating">★ ${Number(p.rating || 0).toFixed(1)} / 5 · ${esc(p.brand || "Quality pick")} · ${Number(p.stock || 0) > 0 ? "In stock" : "Stock status unavailable"}</p><div class="detail-price">${money(p.price)}</div><p class="muted">${esc(p.description || "A great addition to your everyday essentials.")}</p><div class="detail-description"><strong>Why you'll like it</strong><p class="muted">Explore product details and add this item to your cart or wishlist. Product information is provided by the demo product catalogue.</p></div><div class="detail-actions"><button class="btn btn-primary" id="detail-add">Add to cart</button><button class="btn btn-secondary" id="detail-wish">${saved ? "♥ Saved" : "♡ Add to wishlist"}</button></div></section></div>`;
    $("#detail-add").addEventListener("click", () => addToCart(p.id, 1));
    $("#detail-wish").addEventListener("click", () => toggleWishlist(p.id));
  }
  function initSearch() {
    const input = $("#search-input");
    if (input) {
      input.addEventListener("input", () => {
        currentSearch = input.value.trim();
        renderProducts();
      });
      $("#search-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        currentSearch = input.value.trim();
        renderProducts();
        $("#shop")?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }
  function initAuth() {
    const form = $("#auth-form");
    if (!form) return;
    let mode = "login";
    const nameField = $("#name-field"),
      title = $("#auth-title"),
      subtitle = $("#auth-subtitle"),
      submit = $("#auth-submit"),
      message = $("#auth-message"),
      logout = $("#logout-btn"),
      tabs = $$(".auth-tab");
    const session = getSession();
    if (session) {
      title.textContent = `Hello, ${session.name || session.email.split("@")[0]}`;
      subtitle.textContent = `You are logged in as ${session.email}.`;
      form.classList.add("hidden");
      $(".auth-tabs").classList.add("hidden");
      $(".auth-note").classList.add("hidden");
      logout.classList.remove("hidden");
      logout.addEventListener("click", () => {
        localStorage.removeItem(KEYS.session);
        toast("Logged out");
        location.reload();
      });
      return;
    }
    function setMode(next) {
      mode = next;
      tabs.forEach((t) =>
        t.classList.toggle("active", t.dataset.authMode === mode),
      );
      nameField.hidden = mode !== "signup";
      $("#auth-password").autocomplete =
        mode === "signup" ? "new-password" : "current-password";
      title.textContent =
        mode === "login" ? "Welcome back" : "Create your account";
      subtitle.textContent =
        mode === "login"
          ? "Log in to keep your shopping in sync on this browser."
          : "Create a demo account to save your shopping activity.";
      submit.textContent = mode === "login" ? "Login" : "Create account";
      message.className = "notice hidden";
      message.textContent = "";
    }
    tabs.forEach((t) =>
      t.addEventListener("click", () => setMode(t.dataset.authMode)),
    );
    $("#password-toggle").addEventListener("click", () => {
      const input = $("#auth-password"),
        show = input.type === "password";
      input.type = show ? "text" : "password";
      $("#password-toggle").textContent = show ? "Hide" : "Show";
      $("#password-toggle").setAttribute(
        "aria-label",
        show ? "Hide password" : "Show password",
      );
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      ["name-error", "email-error", "password-error"].forEach(
        (id) => ($("#" + id).textContent = ""),
      );
      const name = $("#auth-name").value.trim(),
        email = $("#auth-email").value.trim().toLowerCase(),
        password = $("#auth-password").value;
      let valid = true;
      if (mode === "signup" && name.length < 2) {
        $("#name-error").textContent =
          "Enter your name (at least 2 characters).";
        valid = false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        $("#email-error").textContent = "Enter a valid email address.";
        valid = false;
      }
      if (password.length < 6) {
        $("#password-error").textContent =
          "Password must be at least 6 characters.";
        valid = false;
      }
      if (!valid) return;
      const users = safeRead(KEYS.users, []);
      if (mode === "signup") {
        if (users.some((u) => u.email === email)) {
          message.textContent =
            "An account with this email already exists. Please log in.";
          message.className = "notice error";
          return;
        }
        users.push({ name, email, password });
        write(KEYS.users, users);
        write(KEYS.session, { name, email });
        message.textContent = "Account created successfully.";
        message.className = "notice success";
      } else {
        const user = users.find(
          (u) => u.email === email && u.password === password,
        );
        if (!user) {
          message.textContent =
            "Email or password is incorrect. If this is your first time, create an account.";
          message.className = "notice error";
          return;
        }
        write(KEYS.session, { name: user.name, email: user.email });
        message.textContent = "Login successful.";
        message.className = "notice success";
      }
      const next = new URLSearchParams(location.search).get("next");
      setTimeout(
        () =>
          (location.href = next === "cart.html" ? "cart.html" : "index.html"),
        500,
      );
    });
  }
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    updateHeader();
    initSearch();
    initAuth();
    renderCart();
    renderWishlist();
    loadProducts();
  });
})();
