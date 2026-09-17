(function () {
  "use strict";

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var PRODUCTS = window.PRODUCTS_DATA || [];
  var REVIEWS = window.REVIEW_POOL || [];
  var CATEGORIES = window.CATEGORIES_DATA || [];

  function productById(id) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i];
    return null;
  }
  function categoryByslug(slug) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].slug === slug) return CATEGORIES[i];
    return null;
  }
  function money(v) {
    return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " грн";
  }
  function iconSvg(name, size) {
    var bodies = {
      photo: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10.5" r="1.8"/><path d="M4 17l5-4.5 3 2.5 3.5-3.5L20 16"/>',
      cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.4l2.1 11.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21 7H6"/>',
      check: '<polyline points="5,13 10,18 19,7"/>',
      trash: '<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>'
    };
    var s = size || 20;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (bodies[name] || bodies.check) + '</svg>';
  }
  function starsRow(rating) {
    var out = "";
    for (var i = 0; i < 5; i++) {
      out += '<span class="' + (i < Math.round(rating) ? "star-on" : "star-off") + '">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">' +
        '<path d="M12 3.5l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.8 6.6 19.7l1.2-5.9L3.4 9.7l6-.7z"/></svg></span>';
    }
    return '<span class="stars">' + out + '</span>';
  }

  // ------------------------------------------------------------------
  // Cart storage (localStorage) — { productId: qty }
  // ------------------------------------------------------------------
  var CART_KEY = "autoparts_cart";
  var PROMO_KEY = "autoparts_promo";

  function getCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function setCart(cart) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
    updateCartBadge();
  }
  function addToCart(id, qty) {
    var cart = getCart();
    cart[id] = (cart[id] || 0) + (qty || 1);
    setCart(cart);
  }
  function setQty(id, qty) {
    var cart = getCart();
    if (qty <= 0) { delete cart[id]; } else { cart[id] = qty; }
    setCart(cart);
  }
  function removeFromCart(id) {
    var cart = getCart();
    delete cart[id];
    setCart(cart);
  }
  function getPromo() {
    try {
      var raw = localStorage.getItem(PROMO_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function setPromo(promo) {
    try {
      if (promo) localStorage.setItem(PROMO_KEY, JSON.stringify(promo));
      else localStorage.removeItem(PROMO_KEY);
    } catch (e) {}
  }
  function cartLines() {
    var cart = getCart();
    var lines = [];
    Object.keys(cart).forEach(function (id) {
      var p = productById(id);
      if (p) lines.push({ product: p, qty: cart[id] });
    });
    return lines;
  }
  function cartSubtotal(lines) {
    return lines.reduce(function (sum, l) { return sum + l.product.price * l.qty; }, 0);
  }
  function updateCartBadge() {
    var badge = qs("#cart-badge");
    if (!badge) return;
    var cart = getCart();
    var count = Object.keys(cart).reduce(function (s, k) { return s + cart[k]; }, 0);
    if (count > 0) { badge.textContent = count; badge.hidden = false; }
    else { badge.hidden = true; }
  }

  // ------------------------------------------------------------------
  // Toast
  // ------------------------------------------------------------------
  var toastEl = null;
  function showToast(text) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = iconSvg("check", 18) + "<span>" + text + "</span>";
    toastEl.classList.add("show");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  // ------------------------------------------------------------------
  // Global: mobile nav + add-to-cart delegation + forms
  // ------------------------------------------------------------------
  function initMobileNav() {
    var toggle = qs("#mobile-menu-toggle");
    var header = qs(".site-header");
    if (!toggle || !header) return;
    toggle.addEventListener("click", function () {
      header.classList.toggle("mobile-open");
    });
  }

  function initGlobalAddToCart() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".btn-add-cart") : null;
      if (!btn || btn.disabled) return;
      var id = btn.getAttribute("data-product-id");
      if (!id) return;
      addToCart(id, 1);
      var p = productById(id);
      showToast((p ? p.name : "Товар") + " додано в кошик");
    });
  }

  function wireSuccessForm(formId, successId, opts) {
    var form = qs("#" + formId);
    var success = qs("#" + successId);
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      qsa("[required]", form).forEach(function (field) {
        field.classList.remove("field-error");
        if (!field.value || !field.value.trim()) { field.classList.add("field-error"); ok = false; }
      });
      if (!ok) return;
      form.reset();
      if (success) { success.hidden = false; }
      if (opts && opts.onSuccess) opts.onSuccess();
    });
  }

  // ------------------------------------------------------------------
  // Catalog page
  // ------------------------------------------------------------------
  function initCatalog() {
    var grid = qs("#catalog-grid");
    if (!grid) return;

    var params = new URLSearchParams(window.location.search);
    var state = {
      search: params.get("search") || "",
      categories: params.get("category") ? [params.get("category")] : [],
      brands: [],
      priceMin: null,
      priceMax: null,
      inStock: false,
      sort: "popular",
      page: 1,
    };
    var PAGE_SIZE = 8;

    var searchInput = qs("#catalog-search-input");
    if (searchInput) searchInput.value = state.search;
    qsa('input[name="category"]', grid.parentElement.parentElement).forEach(function (cb) {
      if (state.categories.indexOf(cb.value) !== -1) cb.checked = true;
    });

    function computeList() {
      var list = PRODUCTS.slice();
      if (state.categories.length) {
        list = list.filter(function (p) { return state.categories.indexOf(p.category) !== -1; });
      }
      if (state.brands.length) {
        list = list.filter(function (p) { return state.brands.indexOf(p.brand) !== -1; });
      }
      if (state.priceMin != null) list = list.filter(function (p) { return p.price >= state.priceMin; });
      if (state.priceMax != null) list = list.filter(function (p) { return p.price <= state.priceMax; });
      if (state.inStock) list = list.filter(function (p) { return p.in_stock; });
      if (state.search) {
        var q = state.search.trim().toLowerCase();
        list = list.filter(function (p) {
          return p.name.toLowerCase().indexOf(q) !== -1 || p.sku.toLowerCase().indexOf(q) !== -1;
        });
      }
      if (state.sort === "price-asc") list.sort(function (a, b) { return a.price - b.price; });
      else if (state.sort === "price-desc") list.sort(function (a, b) { return b.price - a.price; });
      else if (state.sort === "name-asc") list.sort(function (a, b) { return a.name.localeCompare(b.name, "uk"); });
      return list;
    }

    function productCardHtml(p) {
      var priceOld = p.old_price ? '<span class="price-old">' + money(p.old_price) + "</span>" : "";
      var stock = p.in_stock
        ? '<span class="stock-badge in">В наявності</span>'
        : '<span class="stock-badge out">Під замовлення</span>';
      return '<div class="product-card" data-product-id="' + p.id + '">' +
        '<a href="product.html?id=' + p.id + '" class="product-thumb">' + iconSvg("photo", 40) + "</a>" +
        '<div class="product-body">' +
        '<div class="product-brand">' + p.brand + "</div>" +
        '<a href="product.html?id=' + p.id + '" class="product-name">' + p.name + "</a>" +
        '<div class="product-price-row"><span class="price-new">' + money(p.price) + "</span>" + priceOld + "</div>" +
        stock +
        '<button type="button" class="btn btn-primary btn-block btn-add-cart" data-product-id="' + p.id + '" ' +
        (p.in_stock ? "" : "disabled") + ">" + iconSvg("cart", 16) + " " +
        (p.in_stock ? "У кошик" : "Немає в наявності") + "</button></div></div>";
    }

    function render() {
      var list = computeList();
      var countEl = qs("#catalog-count");
      var emptyEl = qs("#catalog-empty");
      var pagerEl = qs("#catalog-pagination");
      if (countEl) countEl.textContent = "Товарів: " + list.length;

      if (!list.length) {
        grid.innerHTML = "";
        if (emptyEl) emptyEl.hidden = false;
        if (pagerEl) pagerEl.innerHTML = "";
        return;
      }
      if (emptyEl) emptyEl.hidden = true;

      var totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
      if (state.page > totalPages) state.page = totalPages;
      var start = (state.page - 1) * PAGE_SIZE;
      var pageItems = list.slice(start, start + PAGE_SIZE);
      grid.innerHTML = pageItems.map(productCardHtml).join("");

      if (pagerEl) {
        if (totalPages <= 1) { pagerEl.innerHTML = ""; }
        else {
          var html = "";
          for (var i = 1; i <= totalPages; i++) {
            html += '<button type="button" class="page-btn' + (i === state.page ? " active" : "") +
              '" data-page="' + i + '">' + i + "</button>";
          }
          pagerEl.innerHTML = html;
        }
      }
    }

    // wire filter controls
    qsa('input[name="category"]', grid.closest(".catalog-layout")).forEach(function (cb) {
      cb.addEventListener("change", function () {
        state.categories = qsa('input[name="category"]:checked', grid.closest(".catalog-layout")).map(function (c) { return c.value; });
        state.page = 1; render();
      });
    });
    qsa('input[name="brand"]', grid.closest(".catalog-layout")).forEach(function (cb) {
      cb.addEventListener("change", function () {
        state.brands = qsa('input[name="brand"]:checked', grid.closest(".catalog-layout")).map(function (c) { return c.value; });
        state.page = 1; render();
      });
    });
    var priceMinEl = qs("#price-min"), priceMaxEl = qs("#price-max");
    if (priceMinEl) priceMinEl.addEventListener("input", function () {
      state.priceMin = this.value ? parseFloat(this.value) : null; state.page = 1; render();
    });
    if (priceMaxEl) priceMaxEl.addEventListener("input", function () {
      state.priceMax = this.value ? parseFloat(this.value) : null; state.page = 1; render();
    });
    var inStockEl = qs("#filter-in-stock");
    if (inStockEl) inStockEl.addEventListener("change", function () {
      state.inStock = this.checked; state.page = 1; render();
    });
    if (searchInput) searchInput.addEventListener("input", function () {
      state.search = this.value; state.page = 1; render();
    });
    var sortEl = qs("#catalog-sort");
    if (sortEl) sortEl.addEventListener("change", function () {
      state.sort = this.value; render();
    });
    var resetBtn = qs("#filters-reset");
    function resetFilters() {
      state.categories = []; state.brands = []; state.priceMin = null; state.priceMax = null;
      state.inStock = false; state.search = ""; state.sort = "popular"; state.page = 1;
      qsa('input[name="category"], input[name="brand"]', grid.closest(".catalog-layout")).forEach(function (c) { c.checked = false; });
      if (priceMinEl) priceMinEl.value = "";
      if (priceMaxEl) priceMaxEl.value = "";
      if (inStockEl) inStockEl.checked = false;
      if (searchInput) searchInput.value = "";
      if (sortEl) sortEl.value = "popular";
      render();
    }
    if (resetBtn) resetBtn.addEventListener("click", resetFilters);
    var emptyResetLink = qs("#catalog-empty-reset");
    if (emptyResetLink) emptyResetLink.addEventListener("click", function (e) { e.preventDefault(); resetFilters(); });

    var pagerEl2 = qs("#catalog-pagination");
    if (pagerEl2) pagerEl2.addEventListener("click", function (e) {
      var btn = e.target.closest(".page-btn");
      if (!btn) return;
      state.page = parseInt(btn.getAttribute("data-page"), 10);
      render();
      window.scrollTo({ top: grid.getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" });
    });

    render();
  }

  // ------------------------------------------------------------------
  // Product page
  // ------------------------------------------------------------------
  function hashIndex(str, mod) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h += str.charCodeAt(i);
    return h % mod;
  }

  function initProduct() {
    var root = qs("#product-root");
    if (!root) return;
    var params = new URLSearchParams(window.location.search);
    var id = params.get("id");
    var p = id ? productById(id) : null;

    if (!p) {
      root.closest("section").hidden = true;
      qs(".product-tabs") && (qs(".product-tabs").hidden = true);
      qs("#product-not-found").hidden = false;
      return;
    }

    var cat = categoryByslug(p.category);
    var bc = qs("#product-breadcrumbs");
    if (bc) {
      bc.innerHTML = '<a href="index.html">Головна</a><span class="bc-sep">/</span>' +
        '<a href="catalog.html">Каталог</a><span class="bc-sep">/</span>' +
        (cat ? '<a href="catalog.html?category=' + cat.slug + '">' + cat.name + '</a><span class="bc-sep">/</span>' : "") +
        '<span aria-current="page">' + p.name + "</span>";
    }

    var gallery = qs("#product-gallery");
    var thumbsHtml = "";
    for (var i = 0; i < p.images; i++) {
      thumbsHtml += '<div class="thumb' + (i === 0 ? " active" : "") + '" data-idx="' + i + '">' + iconSvg("photo", 24) + "</div>";
    }
    gallery.innerHTML = '<div class="gallery-main" id="gallery-main">' + iconSvg("photo", 70) + "</div>" +
      '<div class="gallery-thumbs">' + thumbsHtml + "</div>";
    qsa(".thumb", gallery).forEach(function (t) {
      t.addEventListener("click", function () {
        qsa(".thumb", gallery).forEach(function (o) { o.classList.remove("active"); });
        t.classList.add("active");
      });
    });

    qs("#product-brand").textContent = p.brand;
    qs("#product-name").textContent = p.name;
    qs("#product-sku").textContent = "Артикул: " + p.sku;
    var priceOld = p.old_price ? '<span class="price-old">' + money(p.old_price) + "</span>" : "";
    qs("#product-price-row").innerHTML = '<span class="price-new" style="font-size:1.5rem">' + money(p.price) + "</span>" + priceOld;
    qs("#product-stock").innerHTML = p.in_stock
      ? '<span class="stock-badge in">' + iconSvg("check", 14) + " В наявності</span>"
      : '<span class="stock-badge out">Під замовлення, 3-5 днів</span>';
    qs("#product-short").textContent = p.short;
    qs("#product-desc").textContent = p.desc;

    var specsBody = p.specs.map(function (row) {
      return "<tr><td>" + row[0] + "</td><td>" + row[1] + "</td></tr>";
    }).join("");
    qs("#product-specs").innerHTML = specsBody;

    var addBtn = qs("#product-add-cart");
    var qtyInput = qs("#product-qty");
    qs("#product-qty-minus").addEventListener("click", function () {
      qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
    });
    qs("#product-qty-plus").addEventListener("click", function () {
      qtyInput.value = (parseInt(qtyInput.value, 10) || 1) + 1;
    });
    if (!p.in_stock) { addBtn.disabled = true; addBtn.innerHTML = "Немає в наявності"; }
    addBtn.addEventListener("click", function () {
      var qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      addToCart(p.id, qty);
      showToast(p.name + " додано в кошик");
      qs("#product-add-success").hidden = false;
    });

    // related products: same category first, fill up to 4
    var related = PRODUCTS.filter(function (x) { return x.category === p.category && x.id !== p.id; });
    if (related.length < 4) {
      PRODUCTS.forEach(function (x) {
        if (related.length < 4 && x.id !== p.id && related.indexOf(x) === -1) related.push(x);
      });
    }
    related = related.slice(0, 4);
    var relatedGrid = qs("#product-related");
    relatedGrid.innerHTML = related.map(function (rp) {
      var po = rp.old_price ? '<span class="price-old">' + money(rp.old_price) + "</span>" : "";
      var stock = rp.in_stock ? '<span class="stock-badge in">В наявності</span>' : '<span class="stock-badge out">Під замовлення</span>';
      return '<div class="product-card" data-product-id="' + rp.id + '">' +
        '<a href="product.html?id=' + rp.id + '" class="product-thumb">' + iconSvg("photo", 40) + "</a>" +
        '<div class="product-body"><div class="product-brand">' + rp.brand + "</div>" +
        '<a href="product.html?id=' + rp.id + '" class="product-name">' + rp.name + "</a>" +
        '<div class="product-price-row"><span class="price-new">' + money(rp.price) + "</span>" + po + "</div>" + stock +
        '<button type="button" class="btn btn-primary btn-block btn-add-cart" data-product-id="' + rp.id + '" ' +
        (rp.in_stock ? "" : "disabled") + ">" + iconSvg("cart", 16) + " " + (rp.in_stock ? "У кошик" : "Немає в наявності") + "</button></div></div>";
    }).join("");

    // reviews: deterministic pick of 2
    var i1 = hashIndex(p.id, REVIEWS.length);
    var i2 = (i1 + 2) % REVIEWS.length;
    var picked = [REVIEWS[i1], REVIEWS[i2]];
    qs("#product-reviews").innerHTML = picked.map(function (rev) {
      return '<div class="review-card"><div class="review-head">' +
        '<span class="review-avatar">' + rev.name.charAt(0) + "</span>" +
        "<div><div class=\"review-name\">" + rev.name + "</div>" + starsRow(rev.rating) + "</div></div>" +
        '<p class="muted" style="margin-top:10px">' + rev.text + "</p></div>";
    }).join("");
  }

  // ------------------------------------------------------------------
  // Cart page
  // ------------------------------------------------------------------
  function initCartPage() {
    var itemsEl = qs("#cart-items");
    if (!itemsEl) return;

    function render() {
      var lines = cartLines();
      var layout = qs("#cart-layout");
      var emptyEl = qs("#cart-empty");
      if (!lines.length) {
        layout.hidden = true;
        emptyEl.hidden = false;
        return;
      }
      layout.hidden = false;
      emptyEl.hidden = true;

      itemsEl.innerHTML = lines.map(function (l) {
        var p = l.product;
        return '<div class="cart-item" data-product-id="' + p.id + '">' +
          '<a href="product.html?id=' + p.id + '" class="cart-item-thumb">' + iconSvg("photo", 26) + "</a>" +
          '<div><a href="product.html?id=' + p.id + '" class="cart-item-name">' + p.name + "</a>" +
          '<div class="cart-item-brand">' + p.brand + " · Артикул " + p.sku + "</div></div>" +
          '<div class="qty-stepper"><button type="button" class="qty-btn" data-action="minus">−</button>' +
          '<input type="number" min="1" value="' + l.qty + '" data-role="qty" style="width:40px">' +
          '<button type="button" class="qty-btn" data-action="plus">+</button></div>' +
          '<div class="cart-item-price">' + money(p.price * l.qty) + "</div>" +
          '<button type="button" class="cart-item-remove" aria-label="Видалити">' + iconSvg("trash", 18) + "</button></div>";
      }).join("");

      var subtotal = cartSubtotal(lines);
      var promo = getPromo();
      var discount = promo ? Math.round(subtotal * promo.percent / 100) : 0;
      var total = subtotal - discount;

      qs("#cart-subtotal").textContent = money(subtotal);
      var discountRow = qs("#cart-discount-row");
      if (discount > 0) { discountRow.hidden = false; qs("#cart-discount").textContent = "−" + money(discount); }
      else { discountRow.hidden = true; }
      qs("#cart-total").textContent = money(total);
    }

    itemsEl.addEventListener("click", function (e) {
      var row = e.target.closest(".cart-item");
      if (!row) return;
      var id = row.getAttribute("data-product-id");
      if (e.target.closest(".cart-item-remove")) {
        removeFromCart(id); render(); return;
      }
      var actionBtn = e.target.closest("[data-action]");
      if (actionBtn) {
        var cart = getCart();
        var qty = cart[id] || 1;
        qty = actionBtn.getAttribute("data-action") === "plus" ? qty + 1 : qty - 1;
        setQty(id, qty);
        render();
      }
    });
    itemsEl.addEventListener("change", function (e) {
      if (e.target.getAttribute("data-role") !== "qty") return;
      var row = e.target.closest(".cart-item");
      var id = row.getAttribute("data-product-id");
      var qty = Math.max(1, parseInt(e.target.value, 10) || 1);
      setQty(id, qty);
      render();
    });

    var promoForm = qs("#promo-form");
    if (promoForm) promoForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = qs("#promo-input");
      var msg = qs("#promo-msg");
      var code = (input.value || "").trim().toUpperCase();
      if (code === "SALE10") {
        setPromo({ code: code, percent: 10 });
        msg.hidden = false; msg.className = "promo-msg ok"; msg.textContent = "Промокод застосовано: знижка 10%";
      } else {
        setPromo(null);
        msg.hidden = false; msg.className = "promo-msg error"; msg.textContent = "Промокод не знайдено";
      }
      render();
    });

    render();
  }

  // ------------------------------------------------------------------
  // Checkout page
  // ------------------------------------------------------------------
  function initCheckout() {
    var form = qs("#checkout-form");
    if (!form) return;
    var lines = cartLines();
    if (!lines.length) {
      window.location.href = "cart.html";
      return;
    }

    function renderSummary() {
      var itemsEl = qs("#checkout-items");
      itemsEl.innerHTML = lines.map(function (l) {
        return '<div class="summary-row"><span>' + l.product.name + " × " + l.qty + "</span><span>" +
          money(l.product.price * l.qty) + "</span></div>";
      }).join("");
      var subtotal = cartSubtotal(lines);
      var promo = getPromo();
      var discount = promo ? Math.round(subtotal * promo.percent / 100) : 0;
      if (discount > 0) {
        itemsEl.innerHTML += '<div class="summary-row"><span>Знижка за промокодом</span><span>−' + money(discount) + "</span></div>";
      }
      qs("#checkout-total").textContent = money(subtotal - discount);
    }
    renderSummary();

    var deliveryRadios = qsa('input[name="delivery"]', form);
    var addressRow = qs("#delivery-address-row");
    function updateAddressVisibility() {
      var val = form.querySelector('input[name="delivery"]:checked').value;
      addressRow.style.display = val === "pickup" ? "none" : "grid";
    }
    deliveryRadios.forEach(function (r) { r.addEventListener("change", updateAddressVisibility); });
    updateAddressVisibility();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      var requiredFields = [form.querySelector('[name="name"]'), form.querySelector('[name="phone"]')];
      var deliveryVal = form.querySelector('input[name="delivery"]:checked').value;
      if (deliveryVal !== "pickup") {
        requiredFields.push(form.querySelector('[name="city"]'), form.querySelector('[name="branch"]'));
      }
      requiredFields.forEach(function (field) {
        field.classList.remove("field-error");
        if (!field.value || !field.value.trim()) { field.classList.add("field-error"); ok = false; }
      });
      if (!ok) return;

      var orderNumber = "AZ-" + Math.floor(10000 + Math.random() * 89999);
      qs("#order-number").textContent = orderNumber;
      qs("#checkout-section").hidden = true;
      qs("#checkout-success").hidden = false;
      setCart({});
      setPromo(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ------------------------------------------------------------------
  // Accordion (delivery FAQ)
  // ------------------------------------------------------------------
  function initAccordion() {
    qsa(".accordion").forEach(function (acc) {
      qsa(".accordion-item", acc).forEach(function (item) {
        var trigger = qs(".accordion-trigger", item);
        trigger.addEventListener("click", function () {
          item.classList.toggle("open");
        });
      });
    });
  }

  // ------------------------------------------------------------------
  // Home page: hero search + subscribe
  // ------------------------------------------------------------------
  function initHeroSearch() {
    var form = qs("#hero-search-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = qs("#hero-search-input").value.trim();
      window.location.href = "catalog.html" + (q ? "?search=" + encodeURIComponent(q) : "");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateCartBadge();
    initMobileNav();
    initGlobalAddToCart();
    initHeroSearch();
    initCatalog();
    initProduct();
    initCartPage();
    initCheckout();
    initAccordion();
    wireSuccessForm("subscribe-form", "subscribe-success");
    wireSuccessForm("contact-form", "contact-success");
    wireSuccessForm("return-form", "return-success");
  });
})();
