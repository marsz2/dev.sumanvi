// =====================================================
// SUPABASE CONFIGURATION
// =====================================================
const SUPABASE_URL = "https://lovrnggbtczuedheajfn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvdnJuZ2didGN6dWVkaGVhamZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNzE4NTIsImV4cCI6MjEwMzc0Nzg1Mn0.yUjJN36eVR8fTKmVnJWRwqQ9Vk0zykCHYdiQcN4m7Tg";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const categories = [
  { name: "Lighting Solutions", icon: "lightbulb", desc: "LED Bulbs, Tube lights, Flood Lights" },
  { name: "Switches & Sockets", icon: "power", desc: "Modular switches, sockets, buttons" },
  { name: "Wires & Cables", icon: "plug", desc: "Industrial cables, home wiring, pipes" },
  { name: "Protection Devices", icon: "shield", desc: "MCBs, fuses, distribution boards" }
];

const currentConfig = {
  whatsapp_number: "9511228208",
  // Replace this with your WhatsApp Community invite link.
  whatsapp_community_url: "https://chat.whatsapp.com/BiejjHkJqSaLBaowqVvtIO"
};

// =====================================================
// GLOBAL VARIABLES
// =====================================================
let editingProductId = null;
let editingBlogId = null;
let isAdmin = false;
let currentView = "home";
let visibleCount = 6;
let selectedProduct = null;
let favorites = new Set();
let customFields = ["Capacity", "Material", "Thickness", "Unit"];
let allProducts = [];
let allBlogs = [];
let isLoading = false;
let carouselIndex = 0;

// =====================================================
// HELPERS
// =====================================================
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price || 0),
    offer: row.offer,
    image: row.image_url || "",
    image_path: row.image_path || "",
    desc: row.description || "",
    specs: row.specs || {},
    featured: !!row.featured,
    recent: row.created_at
  };
}

function mapBlog(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category || "Industry Guides",
    icon: row.icon || "book-open",
    date: row.publish_date || row.created_at,
    desc: row.excerpt || "",
    content: row.content || "",
    image: row.image_url || "",
    image_path: row.image_path || "",
    slug: row.slug,
    published: !!row.published
  };
}

function isValidImage(file) {
  return file && ["image/jpeg", "image/png"].includes(file.type);
}

function makeStoragePath(folder, file) {
  const ext = file.type === "image/png" ? "png" : "jpg";
  return `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}

async function uploadImage(bucket, folder, file) {
  if (!file) return null;
  if (!isValidImage(file)) throw new Error("Only JPG and PNG images are allowed.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be 5 MB or smaller.");

  const path = makeStoragePath(folder, file);
  const { error } = await supabaseClient.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type
  });

  if (error) throw error;

  const { data } = supabaseClient.storage.from(bucket).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

async function deleteStorageFile(bucket, path) {
  if (!path) return;
  const { error } = await supabaseClient.storage.from(bucket).remove([path]);
  if (error) console.warn("Storage delete warning:", error.message);
}

// =====================================================
// WHATSAPP COMMUNITY POPUP
// =====================================================
function getWhatsAppCommunityUrl() {
  const url = String(currentConfig.whatsapp_community_url || "").trim();

  if (!url || url === "YOUR_WHATSAPP_COMMUNITY_LINK") {
    return "";
  }

  return url;
}

function createWhatsAppCommunityPopup() {
  if (document.getElementById("whatsappCommunityPopup")) return;

  const popup = document.createElement("div");
  popup.id = "whatsappCommunityPopup";
  popup.className = "fixed inset-0 z-[9999] hidden items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]";
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-modal", "true");
  popup.setAttribute("aria-labelledby", "whatsappCommunityTitle");

  popup.innerHTML = `
    <div id="whatsappCommunityDialog"
      class="relative w-full max-w-[320px] overflow-hidden rounded-[2rem] bg-white px-6 py-7 shadow-[0_25px_60px_rgba(16,36,61,0.16)] ring-1 ring-black/5 sm:max-w-[340px]">

      <button id="closeWhatsAppCommunityPopup"
        type="button"
        aria-label="Close WhatsApp Community popup"
        class="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        <i data-lucide="x" class="h-5 w-5"></i>
      </button>

      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_20px_rgba(37,211,102,0.28)]">
        <svg viewBox="0 0 32 32" class="h-8 w-8" aria-hidden="true" fill="none">
          <path fill="currentColor" d="M16 3.5C9.1 3.5 3.5 8.9 3.5 15.6c0 2.2.6 4.3 1.8 6.1L3.7 28.5l7-1.5c1.6.8 3.4 1.2 5.3 1.2 6.9 0 12.5-5.4 12.5-12.1S22.9 3.5 16 3.5Z"/>
          <path fill="#25D366" d="M16 6.2c5.4 0 9.8 4.2 9.8 9.4S21.4 25 16 25c-1.7 0-3.3-.4-4.7-1.1l-.5-.3-3.9.8.8-3.6-.3-.5c-1-1.4-1.5-3-1.5-4.7 0-5.2 4.4-9.4 9.8-9.4Z"/>
          <path fill="white" d="M12.3 10.7c-.3-.1-.6-.1-.8.2l-1 1.1c-.3.3-.4.7-.2 1.1.7 1.7 2.9 4.5 5.2 5.7 1.2.6 2.1.9 2.7.9.4 0 .8-.2 1-.5l.9-1.1c.2-.3.2-.7-.1-.9l-1.7-1c-.3-.2-.7-.1-.9.2l-.6.7c-.1.1-.2.1-.4 0-.7-.4-2.1-1.5-2.9-2.7-.1-.2-.1-.3 0-.5l.5-.6c.2-.3.2-.6 0-.9l-.9-1.7c-.1-.1-.3-.2-.5-.2Z"/>
        </svg>
      </div>

      <div class="mt-4 text-center">
        <h2 id="whatsappCommunityTitle" class="text-[21px] font-extrabold tracking-tight text-[#10243d]">
          Join our community
        </h2>
        <p class="mt-1.5 text-[12px] leading-5 text-slate-500">
          Get the best deals, daily updates &amp; exclusive offers
        </p>
      </div>

      <div class="mt-5">
        <a id="joinWhatsAppCommunityBtn"
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          class="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-[13px] font-extrabold text-white shadow-[0_10px_20px_rgba(37,211,102,0.28)] transition hover:bg-[#1fbd5b] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
        >
          <svg viewBox="0 0 32 32" class="h-5 w-5" aria-hidden="true" fill="none">
            <path fill="currentColor" d="M16 3.5C9.1 3.5 3.5 8.9 3.5 15.6c0 2.2.6 4.3 1.8 6.1L3.7 28.5l7-1.5c1.6.8 3.4 1.2 5.3 1.2 6.9 0 12.5-5.4 12.5-12.1S22.9 3.5 16 3.5Z"/>
            <path fill="#25D366" d="M16 6.2c5.4 0 9.8 4.2 9.8 9.4S21.4 25 16 25c-1.7 0-3.3-.4-4.7-1.1l-.5-.3-3.9.8.8-3.6-.3-.5c-1-1.4-1.5-3-1.5-4.7 0-5.2 4.4-9.4 9.8-9.4Z"/>
            <path fill="white" d="M12.3 10.7c-.3-.1-.6-.1-.8.2l-1 1.1c-.3.3-.4.7-.2 1.1.7 1.7 2.9 4.5 5.2 5.7 1.2.6 2.1.9 2.7.9.4 0 .8-.2 1-.5l.9-1.1c.2-.3.2-.7-.1-.9l-1.7-1c-.3-.2-.7-.1-.9.2l-.6.7c-.1.1-.2.1-.4 0-.7-.4-2.1-1.5-2.9-2.7-.1-.2-.1-.3 0-.5l.5-.6c.2-.3.2-.6 0-.9l-.9-1.7c-.1-.1-.3-.2-.5-.2Z"/>
          </svg>
          Join WhatsApp Channel
        </a>
      </div>

      <div class="mt-4 text-center">
        <div class="inline-flex items-center gap-1 rounded-full bg-[#eef8f2] px-3 py-1 text-[10px] font-semibold text-slate-600">
          <span aria-hidden="true">🔒</span> free - no spam
        </div>
        <p class="mt-2 truncate rounded-full border border-[#d7ebe0] bg-[#f7fcf9] px-2.5 py-1 text-[7px] font-medium text-[#4a8b6d]" title="${getWhatsAppCommunityUrl()}">
          ${getWhatsAppCommunityUrl()}
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Close when clicking anywhere outside the popup card.
  popup.addEventListener("click", event => {
    if (event.target === popup) closeWhatsAppCommunityPopup();
  });

  document.getElementById("closeWhatsAppCommunityPopup")?.addEventListener("click", closeWhatsAppCommunityPopup);

  lucide.createIcons();
}

function openWhatsAppCommunityPopup() {
  const communityUrl = getWhatsAppCommunityUrl();

  if (!communityUrl) {
    console.warn("WhatsApp Community link is not configured.");
    return;
  }

  createWhatsAppCommunityPopup();

  const popup = document.getElementById("whatsappCommunityPopup");
  const joinButton = document.getElementById("joinWhatsAppCommunityBtn");

  if (joinButton) joinButton.href = communityUrl;

  popup.classList.remove("hidden");
  popup.classList.add("flex");
  document.body.classList.add("overflow-hidden");
}

function closeWhatsAppCommunityPopup() {
  const popup = document.getElementById("whatsappCommunityPopup");
  if (!popup) return;

  popup.classList.add("hidden");
  popup.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
}

function initWhatsAppCommunityPopup() {
  createWhatsAppCommunityPopup();

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeWhatsAppCommunityPopup();
  });

  // Supports any existing/new button or link with data-whatsapp-community.
  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-whatsapp-community]");
    if (!trigger) return;

    event.preventDefault();
    openWhatsAppCommunityPopup();
  });

  // Automatically show the popup for every new page visit.
  // A short delay lets the main page render first so the popup feels intentional.
  setTimeout(() => {
    openWhatsAppCommunityPopup();
  }, 700);
}

// =====================================================
// PUBLIC DATA
// =====================================================
async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    allProducts = [];
    showToast("Unable to load products.");
    return;
  }

  allProducts = (data || []).map(mapProduct);
  if (!selectedProduct && allProducts.length) selectedProduct = allProducts[0];

  renderFeaturedCarousel();
  renderProducts();
  renderCategories();
  populateCategoryFilter();
}

async function loadPublicBlogs() {
  const { data, error } = await supabaseClient
    .from("blogs")
    .select("*")
    .eq("published", true)
    .order("publish_date", { ascending: false });

  if (error) {
    console.error(error);
    allBlogs = [];
    renderBlogsList();
    return;
  }

  allBlogs = (data || []).map(mapBlog);
  renderBlogsList();

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const id = params.get("id");
  if (slug || id) showBlogDetail(slug || id);
}

async function loadAdminData() {
  if (!isAdmin) return;

  const [productsResult, blogsResult] = await Promise.all([
    supabaseClient.from("products").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("blogs").select("*").order("publish_date", { ascending: false })
  ]);

  if (!productsResult.error) allProducts = (productsResult.data || []).map(mapProduct);
  if (!blogsResult.error) allBlogs = (blogsResult.data || []).map(mapBlog);

  renderAdminProducts();
  renderAdminBlogs();
  renderProducts();
  renderFeaturedCarousel();
  renderCategories();
  populateCategoryFilter();
}

let lastAdminAuthError = "";

async function checkAdminSession(userOverride = null) {
  lastAdminAuthError = "";
  let user = userOverride;

  if (!user) {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();

    if (userError) {
      lastAdminAuthError = userError.message || "Unable to read the authenticated user.";
      console.error("Supabase getUser error:", userError);
      isAdmin = false;
      return false;
    }

    user = userData?.user;
  }

  if (!user) {
    isAdmin = false;
    return false;
  }

  const { data, error } = await supabaseClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    lastAdminAuthError = error.message || "Admin authorization check failed.";
    console.error("admin_users authorization error:", error);
  }

  const metadataRole =
    user.app_metadata?.role ||
    user.user_metadata?.role ||
    user.user_metadata?.user_role;

  const metadataIsAdmin = String(metadataRole || "").toLowerCase() === "admin";
  isAdmin = !!data || metadataIsAdmin;

  if (!isAdmin && !lastAdminAuthError) {
    lastAdminAuthError =
      "Authenticated successfully, but this Supabase user is not registered as an admin.";
  }

  return isAdmin;
}

async function refreshAdminUI() {
  if (isAdmin) {
    await loadAdminData();
    showView("dashboard");
  } else {
    showView("login");
  }
}

// =====================================================
// ADMIN AUTHENTICATION
// =====================================================
function initAdminAuth() {
  const form = document.getElementById("adminLoginForm");

  if (form && !form.dataset.authBound) {
    form.dataset.authBound = "true";

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const email = document.getElementById("loginUser")?.value.trim();
      const password = document.getElementById("loginPassword")?.value || "";
      const errorBanner = document.getElementById("loginError");
      const button = form.querySelector("button[type='submit']");

      if (errorBanner) {
        errorBanner.classList.add("hidden");
        errorBanner.textContent = "";
      }

      if (!email || !password) {
        if (errorBanner) {
          errorBanner.textContent = "Email and password are required.";
          errorBanner.classList.remove("hidden");
        }
        return;
      }

      if (button) {
        button.disabled = true;
        button.textContent = "Signing in...";
      }

      try {
        const { data: authData, error } =
          await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) throw error;

        const admin = await checkAdminSession(authData?.user || null);

        if (!admin) {
          await supabaseClient.auth.signOut();
          throw new Error(
            lastAdminAuthError ||
            "Login successful, but this account is not authorized as an admin."
          );
        }

        form.reset();
        isAdmin = true;
        currentView = "dashboard";
        showToast("Successfully authenticated as Admin.");

        await loadAdminData();
        showView("dashboard");

        const overviewTab = document.querySelector('.dash-tab[data-tab="overview"]');
        if (overviewTab) overviewTab.click();
      } catch (error) {
        console.error("Admin login error:", error);

        if (errorBanner) {
          errorBanner.textContent = error.message || "Unable to sign in.";
          errorBanner.classList.remove("hidden");
        }
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = "Log In to Dashboard";
        }
      }
    });
  }

  const logoutBtn = document.getElementById("adminLogoutBtn");

  if (logoutBtn && !logoutBtn.dataset.authBound) {
    logoutBtn.dataset.authBound = "true";

    logoutBtn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      isAdmin = false;
      currentView = "home";
      showView("home");
      showToast("Admin logged out.");
    });
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      isAdmin = false;
      return;
    }

    setTimeout(async () => {
      try {
        const admin = await checkAdminSession(session.user);
        isAdmin = admin;

        if (admin && currentView === "login") {
          currentView = "dashboard";
          await loadAdminData();
          showView("dashboard");
        }
      } catch (error) {
        console.error("Auth state check error:", error);
        isAdmin = false;
      }
    }, 0);
  });
}

// =====================================================
// IMAGE INPUT PREVIEWS
// =====================================================
function initImagePreviews() {
  const bindings = [
    ["prodImageFile", "prodImagePreview", "prodImagePreviewContainer"],
    ["blogImageFile", "blogImagePreview", "blogImagePreviewContainer"]
  ];

  bindings.forEach(([inputId, imageId, containerId]) => {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;

      if (!isValidImage(file)) {
        alert("Please choose a JPG or PNG image.");
        input.value = "";
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be 5 MB or smaller.");
        input.value = "";
        return;
      }

      const url = URL.createObjectURL(file);
      const image = document.getElementById(imageId);
      const container = document.getElementById(containerId);

      if (image) image.src = url;
      if (container) container.classList.remove("hidden");
    });
  });
}

// =====================================================
// ADMIN CRUD
// =====================================================
async function saveProduct(event) {
  event.preventDefault();
  if (!isAdmin) return showToast("Admin authentication required.");

  const id = document.getElementById("prodId").value;
  const name = document.getElementById("prodName").value.trim();
  const category = document.getElementById("prodCategory").value;
  const price = Number(document.getElementById("prodPrice").value);
  const offer = document.getElementById("prodOffer").value;
  const description = document.getElementById("prodDesc").value.trim();
  const specsRaw = document.getElementById("prodSpecs").value.trim();
  const featured = document.getElementById("prodFeatured").checked;
  const file = document.getElementById("prodImageFile")?.files?.[0];

  if (!name || !category || !Number.isFinite(price) || !offer || !description || !specsRaw) {
    alert("Please fill all required product fields.");
    return;
  }

  let specs;

  try {
    specs = JSON.parse(specsRaw);
  } catch {
    alert("Specifications must be valid JSON.");
    return;
  }

  const button = event.currentTarget.querySelector("button[type='submit']");
  if (button) button.disabled = true;

  try {
    let imageUrl = null;
    let imagePath = null;
    let oldImagePath = null;

    if (id) {
      const existing = allProducts.find(p => String(p.id) === String(id));
      imageUrl = existing?.image || null;
      imagePath = existing?.image_path || null;
      oldImagePath = imagePath;
    }

    if (file) {
      const uploaded = await uploadImage("product-images", "products", file);
      imageUrl = uploaded.url;
      imagePath = uploaded.path;
    }

    const payload = {
      name,
      category,
      price,
      offer,
      image_url: imageUrl,
      image_path: imagePath,
      description,
      specs,
      featured
    };

    let error;

    if (id) {
      ({ error } = await supabaseClient.from("products").update(payload).eq("id", id));
    } else {
      ({ error } = await supabaseClient.from("products").insert(payload));
    }

    if (error) throw error;

    if (id && file && oldImagePath && oldImagePath !== imagePath) {
      await deleteStorageFile("product-images", oldImagePath);
    }

    document.getElementById("adminProductForm").reset();
    document.getElementById("prodId").value = "";
    document.getElementById("productFormContainer").classList.add("hidden");

    showToast(id ? "Product updated successfully." : "Product added successfully.");
    await loadAdminData();
  } catch (error) {
    console.error(error);
    alert(error.message || "Unable to save product.");
  } finally {
    if (button) button.disabled = false;
  }
}

async function saveBlog(event) {
  event.preventDefault();
  if (!isAdmin) return showToast("Admin authentication required.");

  const id = document.getElementById("blogId").value;
  const title = document.getElementById("blogTitle").value.trim();
  const category = document.getElementById("blogCategory").value.trim();
  const icon = document.getElementById("blogIcon").value;
  const publishDate = document.getElementById("blogDate").value;
  const excerpt = document.getElementById("blogDesc").value.trim();
  const content = document.getElementById("blogContent").value.trim();
  const file = document.getElementById("blogImageFile")?.files?.[0];

  if (!title || !category || !publishDate || !excerpt || !content) {
    alert("Please fill all required blog fields.");
    return;
  }

  const slug = makeSlug(title);
  const button = event.currentTarget.querySelector("button[type='submit']");
  if (button) button.disabled = true;

  try {
    let imageUrl = null;
    let imagePath = null;
    let oldImagePath = null;

    if (id) {
      const existing = allBlogs.find(b => String(b.id) === String(id));
      imageUrl = existing?.image || null;
      imagePath = existing?.image_path || null;
      oldImagePath = imagePath;
    }

    if (file) {
      const uploaded = await uploadImage("blog-images", "blogs", file);
      imageUrl = uploaded.url;
      imagePath = uploaded.path;
    }

    const payload = {
      title,
      slug,
      category,
      icon,
      publish_date: publishDate,
      excerpt,
      content,
      image_url: imageUrl,
      image_path: imagePath,
      published: true
    };

    let error;

    if (id) {
      ({ error } = await supabaseClient.from("blogs").update(payload).eq("id", id));
    } else {
      ({ error } = await supabaseClient.from("blogs").insert(payload));
    }

    if (error) throw error;

    if (id && file && oldImagePath && oldImagePath !== imagePath) {
      await deleteStorageFile("blog-images", oldImagePath);
    }

    document.getElementById("adminBlogForm").reset();
    document.getElementById("blogId").value = "";
    document.getElementById("blogFormContainer").classList.add("hidden");

    showToast(id ? "Blog updated successfully." : "Blog added successfully.");
    await loadAdminData();

    if (document.getElementById("blogsGrid")) await loadPublicBlogs();
  } catch (error) {
    console.error(error);
    alert(error.message || "Unable to save blog.");
  } finally {
    if (button) button.disabled = false;
  }
}

function makeSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function deleteProduct(id) {
  if (!isAdmin) return showToast("Admin authentication required.");

  const product = allProducts.find(p => String(p.id) === String(id));

  if (!product || !confirm(`Are you sure you want to delete product "${product.name}"?`)) return;

  const { error } = await supabaseClient.from("products").delete().eq("id", id);

  if (error) return alert(error.message);

  await deleteStorageFile("product-images", product.image_path);
  showToast("Product deleted successfully.");
  await loadAdminData();
}

async function deleteBlog(id) {
  if (!isAdmin) return showToast("Admin authentication required.");

  const blog = allBlogs.find(b => String(b.id) === String(id));

  if (!blog || !confirm(`Are you sure you want to delete blog post "${blog.title}"?`)) return;

  const { error } = await supabaseClient.from("blogs").delete().eq("id", id);

  if (error) return alert(error.message);

  await deleteStorageFile("blog-images", blog.image_path);
  showToast("Blog post deleted successfully.");
  await loadAdminData();
}

function editProduct(id) {
  const p = allProducts.find(item => String(item.id) === String(id));
  if (!p) return;

  editingProductId = p.id;
  document.getElementById("prodId").value = p.id;
  document.getElementById("prodName").value = p.name;
  document.getElementById("prodCategory").value = p.category;
  document.getElementById("prodPrice").value = p.price;
  document.getElementById("prodOffer").value = p.offer || "";
  document.getElementById("prodDesc").value = p.desc || "";
  document.getElementById("prodSpecs").value = JSON.stringify(p.specs || {}, null, 2);
  document.getElementById("prodFeatured").checked = !!p.featured;
  document.getElementById("prodImageFile").value = "";
  document.getElementById("productFormTitle").textContent = "Edit Product";
  document.getElementById("productFormContainer").classList.remove("hidden");
  document.getElementById("productFormContainer").scrollIntoView({ behavior: "smooth" });
}

function editBlog(id) {
  const b = allBlogs.find(item => String(item.id) === String(id));
  if (!b) return;

  editingBlogId = b.id;
  document.getElementById("blogId").value = b.id;
  document.getElementById("blogTitle").value = b.title;
  document.getElementById("blogCategory").value = b.category;
  document.getElementById("blogIcon").value = b.icon || "lightbulb";
  document.getElementById("blogDate").value = b.date ? String(b.date).slice(0, 10) : "";
  document.getElementById("blogDesc").value = b.desc || "";
  document.getElementById("blogContent").value = b.content || "";
  document.getElementById("blogImageFile").value = "";
  document.getElementById("blogFormTitle").textContent = "Edit Blog Post";
  document.getElementById("blogFormContainer").classList.remove("hidden");
  document.getElementById("blogFormContainer").scrollIntoView({ behavior: "smooth" });
}

function resetProductForm() {
  const form = document.getElementById("adminProductForm");
  if (form) form.reset();

  document.getElementById("prodId").value = "";
  document.getElementById("productFormTitle").textContent = "Add Product";
  document.getElementById("productFormContainer").classList.add("hidden");
}

function resetBlogForm() {
  const form = document.getElementById("adminBlogForm");
  if (form) form.reset();

  document.getElementById("blogId").value = "";
  document.getElementById("blogFormTitle").textContent = "Add Blog Post";
  document.getElementById("blogFormContainer").classList.add("hidden");
}

function renderAdminProducts() {
  const tbody = document.getElementById("adminProductRows");
  if (!tbody) return;

  tbody.innerHTML = allProducts.map(p => `
    <tr class="border-b border-slate-200 dark:border-slate-700 text-sm">
      <td class="py-4 font-bold text-[#10243d] dark:text-white flex items-center gap-2">
        <div class="h-8 w-8 rounded-lg bg-[#113967]/10 flex items-center justify-center text-[#113967] dark:bg-white/10 dark:text-white">
          <i data-lucide="package" class="h-4 w-4"></i>
        </div>
        ${escapeHtml(p.name)}
      </td>
      <td class="dark:text-slate-300">${escapeHtml(p.category)}</td>
      <td class="font-extrabold text-[#113967] dark:text-teal-400">${money(p.price)}</td>
      <td class="dark:text-slate-300">${daysLeft(p.offer)} days left</td>
      <td>
        <span class="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          Live
        </span>
      </td>
      <td>
        <div class="flex gap-2">
          <button class="edit-prod-btn text-teal-600 hover:text-teal-800 font-bold" data-id="${p.id}" type="button">Edit</button>
          <button class="delete-prod-btn text-rose-500 hover:text-rose-700 font-bold" data-id="${p.id}" type="button">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");

  lucide.createIcons();

  tbody.querySelectorAll(".edit-prod-btn").forEach(btn => {
    btn.onclick = () => editProduct(btn.dataset.id);
  });

  tbody.querySelectorAll(".delete-prod-btn").forEach(btn => {
    btn.onclick = () => deleteProduct(btn.dataset.id);
  });
}

function renderAdminBlogs() {
  const tbody = document.getElementById("adminBlogRows");
  if (!tbody) return;

  tbody.innerHTML = allBlogs.map(b => `
    <tr class="border-b border-slate-200 dark:border-slate-700 text-sm">
      <td class="py-4 font-bold text-[#10243d] dark:text-white flex items-center gap-2">
        <div class="h-8 w-8 rounded-lg bg-[#113967]/10 flex items-center justify-center text-[#113967] dark:bg-white/10 dark:text-white">
          <i data-lucide="${escapeHtml(b.icon || "book-open")}" class="h-4 w-4"></i>
        </div>
        ${escapeHtml(b.title)}
      </td>
      <td class="dark:text-slate-300">${escapeHtml(b.category)}</td>
      <td class="dark:text-slate-300">${new Date(b.date).toLocaleDateString("en-IN")}</td>
      <td>
        <div class="flex gap-2">
          <button class="edit-blog-btn text-teal-600 hover:text-teal-800 font-bold" data-id="${b.id}" type="button">Edit</button>
          <button class="delete-blog-btn text-rose-500 hover:text-rose-700 font-bold" data-id="${b.id}" type="button">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");

  lucide.createIcons();

  tbody.querySelectorAll(".edit-blog-btn").forEach(btn => {
    btn.onclick = () => editBlog(btn.dataset.id);
  });

  tbody.querySelectorAll(".delete-blog-btn").forEach(btn => {
    btn.onclick = () => deleteBlog(btn.dataset.id);
  });
}

function initDashboard() {
  document.querySelectorAll(".dash-tab").forEach(tab => {
    tab.onclick = async () => {
      document.querySelectorAll(".dash-tab").forEach(t => {
        t.classList.remove("bg-[#113967]", "text-white");
        t.classList.add("text-slate-700", "hover:bg-slate-100", "dark:text-slate-350", "dark:hover:bg-slate-800");
      });

      tab.classList.add("bg-[#113967]", "text-white");
      tab.classList.remove("text-slate-700", "hover:bg-slate-100", "dark:text-slate-350", "dark:hover:bg-slate-800");

      const activePanel = document.getElementById(tab.dataset.tab + "Panel");
      document.querySelectorAll(".dash-panel").forEach(p => p.classList.add("hidden"));
      if (activePanel) activePanel.classList.remove("hidden");

      if (tab.dataset.tab === "products" || tab.dataset.tab === "blogs") {
        await loadAdminData();
      }

      if (tab.dataset.tab === "masters") renderCustomFields();
    };
  });

  const addProductBtn = document.getElementById("addProductDemo");

  if (addProductBtn) {
    addProductBtn.onclick = () => {
      resetProductForm();
      document.getElementById("productFormContainer").classList.remove("hidden");
      document.getElementById("productFormContainer").scrollIntoView({ behavior: "smooth" });
    };
  }

  const productForm = document.getElementById("adminProductForm");
  if (productForm) productForm.addEventListener("submit", saveProduct);

  const cancelProductBtn = document.getElementById("cancelProductBtn");
  if (cancelProductBtn) cancelProductBtn.onclick = resetProductForm;

  const addBlogBtn = document.getElementById("addBlogBtn");

  if (addBlogBtn) {
    addBlogBtn.onclick = () => {
      resetBlogForm();
      document.getElementById("blogDate").value = new Date().toISOString().slice(0, 10);
      document.getElementById("blogFormContainer").classList.remove("hidden");
      document.getElementById("blogFormContainer").scrollIntoView({ behavior: "smooth" });
    };
  }

  const blogForm = document.getElementById("adminBlogForm");
  if (blogForm) blogForm.addEventListener("submit", saveBlog);

  const cancelBlogBtn = document.getElementById("cancelBlogBtn");
  if (cancelBlogBtn) cancelBlogBtn.onclick = resetBlogForm;

  const fieldForm = document.getElementById("fieldForm");

  if (fieldForm) {
    fieldForm.onsubmit = e => {
      e.preventDefault();

      const input = document.getElementById("fieldName");
      const name = input.value.trim();

      if (name && !customFields.includes(name)) {
        customFields.push(name);
        renderCustomFields();
        input.value = "";
        showToast(`Master attribute "${escapeHtml(name)}" added successfully.`);
      }
    };
  }
}

// =====================================================
// BLOG PAGE
// =====================================================
function renderBlogsList() {
  const grid = document.getElementById("blogsGrid");
  if (!grid) return;

  if (!allBlogs.length) {
    grid.innerHTML = `<p class="col-span-full text-center text-slate-500 py-10">No published blogs yet.</p>`;
    return;
  }

  grid.innerHTML = allBlogs.map(b => `
    <article class="premium-card glass-card rounded-[2rem] p-4 flex flex-col justify-between">
      <div>
        <div class="blog-art flex h-48 items-center justify-center rounded-3xl mb-4 overflow-hidden">
          ${
            b.image
              ? `<img src="${escapeHtml(b.image)}" alt="${escapeHtml(b.title)}" class="h-full w-full object-cover">`
              : `<div class="rounded-[2rem] bg-white/70 p-6 shadow-xl"><i data-lucide="${escapeHtml(b.icon || "book-open")}" class="h-16 w-16 text-[#113967]"></i></div>`
          }
        </div>
        <p class="text-xs font-extrabold uppercase tracking-[0.18em] text-[#26a69a]">${escapeHtml(b.category)}</p>
        <h3 class="mt-2 text-2xl font-bold text-[#10243d] dark:text-white leading-tight">${escapeHtml(b.title)}</h3>
        <p class="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400 line-clamp-3">${escapeHtml(b.desc)}</p>
      </div>
      <div class="mt-6">
        <button data-id="${escapeHtml(b.slug || b.id)}" class="read-article-btn focus-ring inline-flex items-center gap-2 rounded-2xl bg-[#113967] px-5 py-3.5 text-sm font-extrabold text-white hover:bg-[#0b2a4f] transition w-full justify-center" type="button">
          Read Article <i data-lucide="arrow-right" class="h-4 w-4"></i>
        </button>
      </div>
    </article>
  `).join("");

  lucide.createIcons();

  grid.querySelectorAll(".read-article-btn").forEach(btn => {
    btn.onclick = () => showBlogDetail(btn.dataset.id);
  });
}

function showBlogDetail(identifier) {
  const b = allBlogs.find(item =>
    String(item.id) === String(identifier) || item.slug === identifier
  );

  if (!b) return;

  const url = new URL(window.location.href);
  url.search = `?slug=${encodeURIComponent(b.slug || b.id)}`;
  window.history.pushState({}, "", url);

  const category = document.getElementById("blogDetailCategory");
  const title = document.getElementById("blogDetailTitle");
  const date = document.getElementById("blogDetailDate");
  const content = document.getElementById("blogDetailContent");
  const image = document.getElementById("blogDetailImage");

  if (category) category.textContent = b.category;
  if (title) title.textContent = b.title;
  if (date) date.textContent = "Last Updated: " + new Date(b.date).toLocaleDateString("en-IN");
  if (content) content.textContent = b.content || b.desc;

  if (image) {
    if (b.image) {
      image.src = b.image;
      image.alt = b.title;
      image.classList.remove("hidden");
    } else {
      image.classList.add("hidden");
    }
  }

  document.getElementById("blogsHeader")?.classList.add("hidden");
  document.getElementById("blogsSection")?.classList.add("hidden");
  document.getElementById("blogDetailContainer")?.classList.remove("hidden");
  document.getElementById("blogDetailContainer")?.scrollIntoView({ behavior: "smooth" });
}

function hideBlogDetail() {
  const url = new URL(window.location.href);
  url.search = "";
  window.history.pushState({}, "", url);

  document.getElementById("blogDetailContainer")?.classList.add("hidden");
  document.getElementById("blogsHeader")?.classList.remove("hidden");
  document.getElementById("blogsSection")?.classList.remove("hidden");
  document.getElementById("blogsHeader")?.scrollIntoView({ behavior: "smooth" });
}

// =====================================================
// MARKETPLACE UI LOGIC
// =====================================================
function money(value) {
  return "₹" + Number(value || 0).toLocaleString("en-IN");
}

function daysLeft(dateString) {
  const target = new Date(dateString);
  const now = new Date();
  const diff = Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
  return diff;
}

function productSvg(product) {
  if (product.image) {
    return `<div class="product-art flex h-48 items-center justify-center rounded-3xl overflow-hidden">
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="h-full w-full object-contain p-4 transition-transform duration-300 hover:scale-105" />
    </div>`;
  }

  const icon =
    product.category.includes("Lighting")
      ? "lightbulb"
      : product.category.includes("Switches")
        ? "power"
        : product.category.includes("Wires")
          ? "plug"
          : "shield";

  return `<div class="product-art flex h-48 items-center justify-center rounded-3xl">
    <div class="rounded-[2rem] bg-white/70 p-8 shadow-xl">
      <i data-lucide="${icon}" class="h-20 w-20 text-[#113967]"></i>
    </div>
  </div>`;
}

function createProductCard(product, isCarousel = false) {
  const isFav = favorites.has(product.id);

  return `
    <article class="premium-card glass-card rounded-[2rem] p-4 product-grid-card ${isCarousel ? "h-full" : ""}">
      ${productSvg(product)}
      <div class="mt-4 card-body">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-extrabold uppercase tracking-[0.18em] text-[#26a69a]">${escapeHtml(product.category)}</p>
            <h3 class="mt-1 text-xl font-extrabold text-[#10243d] dark:text-white">${escapeHtml(product.name)}</h3>
          </div>
          <button class="favorite-btn focus-ring rounded-full bg-white p-2 text-[#26a69a] shadow-sm dark:bg-slate-800 dark:text-teal-400" data-id="${product.id}" type="button" aria-label="Save favorite">
            <i data-lucide="star" class="h-5 w-5" ${isFav ? 'fill="currentColor"' : ""}></i>
          </button>
        </div>
        <p class="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">${escapeHtml(product.desc)}</p>
        <div class="mt-4 flex items-center justify-between">
          <p class="text-2xl font-extrabold text-[#113967] dark:text-teal-400">${money(product.price)}</p>
          <p class="rounded-full bg-[#26a69a]/15 px-3 py-1 text-xs font-extrabold text-[#0f766e] dark:bg-[#26a69a]/20 dark:text-[#2dd4bf]">${daysLeft(product.offer)} days left</p>
        </div>
        <div class="card-actions mt-4">
          <button class="contact-whatsapp whatsapp-btn focus-ring rounded-2xl w-full px-3 py-3 text-sm font-extrabold text-white" data-id="${product.id}" type="button">WhatsApp Inquiry</button>
          <button class="details-btn focus-ring w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:hover:bg-slate-700" data-id="${product.id}" type="button">View Details</button>
        </div>
      </div>
    </article>
  `;
}

function renderFeaturedCarousel() {
  const featured = allProducts.filter(p => p.featured);
  const track = document.getElementById("carouselTrack");

  if (!track) return;

  if (featured.length === 0) {
    track.innerHTML = '<div class="text-slate-500 p-6">No featured products</div>';
    return;
  }

  track.innerHTML = featured
    .map(p => `<div class="carousel-slide">${createProductCard(p, true)}</div>`)
    .join("");

  lucide.createIcons();
  attachProductActions();
  updateCarousel();
}

function updateCarousel() {
  const track = document.getElementById("carouselTrack");
  if (!track) return;

  const slides = track.querySelectorAll(".carousel-slide");
  if (slides.length === 0) return;

  const slideWidth = slides[0].offsetWidth + 20;
  const maxIndex = Math.max(0, slides.length - Math.floor(track.offsetWidth / slideWidth));

  if (carouselIndex > maxIndex) carouselIndex = maxIndex;
  if (carouselIndex < 0) carouselIndex = 0;

  track.style.transform = `translateX(-${carouselIndex * slideWidth}px)`;
}

function filteredProducts() {
  const q = document.getElementById("catalogSearch")?.value?.toLowerCase() || "";
  const cat = document.getElementById("categoryFilter")?.value || "All";
  const sort = document.getElementById("sortFilter")?.value || "featured";

  let list = allProducts.filter(p =>
    (cat === "All" || p.category === cat) &&
    (
      p.name.toLowerCase().includes(q) ||
      p.desc.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
  );

  if (sort === "priceLow") list.sort((a, b) => a.price - b.price);
  if (sort === "recent") list.sort((a, b) => new Date(b.recent || 0) - new Date(a.recent || 0));
  if (sort === "featured") list.sort((a, b) => Number(b.featured || false) - Number(a.featured || false));

  return list;
}

function renderProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  const list = filteredProducts();
  const visible = list.slice(0, visibleCount);

  grid.innerHTML = visible.map(p => createProductCard(p, false)).join("");

  const resultCount = document.getElementById("resultCount");
  if (resultCount) {
    resultCount.textContent = `Showing ${visible.length} of ${list.length} products`;
  }

  const loadMoreBtn = document.getElementById("loadMoreBtn");
  if (loadMoreBtn) {
    loadMoreBtn.classList.toggle("hidden", visible.length >= list.length);
  }

  lucide.createIcons();
  attachProductActions();
}

function attachProductActions() {
  document.querySelectorAll(".details-btn").forEach(btn => {
    btn.onclick = () => {
      selectedProduct = allProducts.find(p => String(p.id) === String(btn.dataset.id));
      if (!selectedProduct) return;

      renderDetails();
      showView("details");
    };
  });

  document.querySelectorAll(".favorite-btn").forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      favorites.has(id) ? favorites.delete(id) : favorites.add(id);
      renderProducts();
      renderFeaturedCarousel();
    };
  });

  attachContactButtons();
}

function renderDetails() {
  const p = selectedProduct;
  if (!p) return;

  const related = allProducts
    .filter(item => item.category === p.category && item.id !== p.id)
    .slice(0, 3);

  const details = document.getElementById("productDetails");
  if (!details) return;

  details.innerHTML = `
    <article class="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <div class="glass-card rounded-[2rem] p-5">
        ${productSvg(p)}
        <div class="mt-4 grid grid-cols-3 gap-3">
          ${[1, 2, 3].map(() => `
            <div class="product-art flex h-24 items-center justify-center rounded-2xl">
              <i data-lucide="image" class="h-8 w-8 text-[#113967]"></i>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="glass-card rounded-[2rem] p-6">
        <p class="font-extrabold uppercase tracking-[0.22em] text-[#26a69a]">${escapeHtml(p.category)}</p>
        <h1 class="mt-2 text-4xl font-extrabold text-[#10243d] dark:text-white">${escapeHtml(p.name)}</h1>
        <p class="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-400">
          ${escapeHtml(p.desc)} Suitable for B2B procurement, factories, warehouses and distribution needs.
          Contact us for bulk order pricing, custom sizes and availability.
        </p>

        <div class="mt-5 flex flex-wrap gap-3">
          <span class="rounded-full bg-[#113967]/10 px-4 py-2 font-extrabold text-[#113967] dark:bg-white/10 dark:text-white">${money(p.price)}</span>
          <span class="rounded-full bg-[#26a69a]/15 px-4 py-2 font-extrabold text-[#0f766e] dark:bg-[#26a69a]/20 dark:text-[#2dd4bf]">Offer valid till ${new Date(p.offer).toLocaleDateString("en-IN")}</span>
          <span class="rounded-full bg-[#26a69a]/15 px-4 py-2 font-extrabold text-[#0f766e] dark:bg-[#26a69a]/20 dark:text-[#2dd4bf]">${daysLeft(p.offer)} days left</span>
        </div>

        <h2 class="mt-7 text-2xl font-extrabold dark:text-white">Specifications</h2>

        <div class="mt-4 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700">
          ${Object.entries(p.specs || {}).map(([k, v]) => `
            <div class="grid grid-cols-2 border-b border-slate-200 dark:border-slate-700 last:border-b-0">
              <div class="bg-slate-50 dark:bg-slate-800/50 p-4 font-extrabold dark:text-white">${escapeHtml(k)}</div>
              <div class="p-4 dark:text-slate-300">${escapeHtml(v)}</div>
            </div>
          `).join("")}
        </div>

        <div class="sticky bottom-4 mt-6 rounded-3xl bg-white/90 dark:bg-[#10243d]/90 p-3 shadow-2xl">
          <button class="contact-whatsapp whatsapp-btn focus-ring rounded-2xl px-5 py-4 font-extrabold text-white w-full" type="button">
            WhatsApp Inquiry
          </button>
        </div>
      </div>
    </article>

    <section class="mt-8">
      <h2 class="mb-4 text-2xl font-extrabold dark:text-white">Related products</h2>
      <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        ${related.map(item => createProductCard(item, false)).join("")}
      </div>
    </section>
  `;

  lucide.createIcons();
  attachProductActions();
}

function showView(view) {
  if (view === "dashboard" && !isAdmin) view = "login";
  if (view === "login" && isAdmin) view = "dashboard";

  currentView = view;

  document.querySelectorAll(".view-section").forEach(section => section.classList.add("hidden"));

  const target = document.getElementById(view + "View");
  if (target) target.classList.remove("hidden");

  const mobileMenu = document.getElementById("mobileMenu");
  if (mobileMenu) mobileMenu.classList.add("hidden");

  const contactSection = document.getElementById("contactSection");

  if (contactSection) {
    if (view === "dashboard" || view === "terms" || view === "login") {
      contactSection.classList.add("hidden");
    } else {
      contactSection.classList.remove("hidden");
    }
  }

  document.querySelectorAll(".nav-btn").forEach(btn => {
    if (btn.dataset.view === view) {
      btn.classList.add("bg-[#113967]", "text-white");
      btn.classList.remove("text-slate-700", "hover:bg-slate-100");
    } else {
      btn.classList.remove("bg-[#113967]", "text-white");
      btn.classList.add("text-slate-700", "hover:bg-slate-100");
    }
  });

  const mainContent = document.getElementById("mainContent");
  if (mainContent) mainContent.scrollIntoView({ behavior: "smooth", block: "start" });

  if (view === "home") setTimeout(updateCarousel, 100);
}

function attachContactButtons() {
  document.querySelectorAll(".contact-whatsapp").forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();

      const number = currentConfig.whatsapp_number;
      const productId = btn.dataset.id ? Number(btn.dataset.id) : null;

      let product = null;

      if (productId) {
        product = allProducts.find(p => p.id === productId);
      } else if (selectedProduct && (currentView === "details" || btn.closest("#productDetails"))) {
        product = selectedProduct;
      }

      let text = "";

      if (product) {
        text = `Hi J S K Enterprises,
I'm interested in:
Product: ${product.name}
Description: ${product.desc}
Price: ${money(product.price)}`;
      } else {
        text = "Hello J S K Enterprises, I'm visiting your B2B Electricals items marketplace. Please share more details.";
      }

      window.open(
        `https://wa.me/${number}?text=${encodeURIComponent(text)}`,
        "_blank"
      );
    };
  });
}

function renderCategories() {
  const grid = document.getElementById("categoryGrid");
  if (!grid) return;

  grid.innerHTML = categories.map(cat => `
    <button class="premium-card glass-card rounded-3xl p-5 text-left focus-ring flex flex-col justify-between h-full w-full" type="button" data-category="${escapeHtml(cat.name)}">
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#113967]/10 text-[#113967] dark:bg-white/10 dark:text-white mb-4">
        <i data-lucide="${cat.icon}" class="h-6 w-6"></i>
      </div>
      <div>
        <h3 class="text-lg font-extrabold text-[#10243d] dark:text-white">${escapeHtml(cat.name)}</h3>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">${escapeHtml(cat.desc)}</p>
      </div>
    </button>
  `).join("");

  grid.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      const cat = btn.dataset.category;
      const select = document.getElementById("categoryFilter");

      if (select) select.value = cat;

      showView("marketplace");
      renderProducts();
    };
  });

  lucide.createIcons();
}

function populateCategoryFilter() {
  const select = document.getElementById("categoryFilter");
  if (!select) return;

  select.innerHTML = '<option value="All">All categories</option>';

  categories.forEach(cat => {
    select.innerHTML += `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`;
  });
}

function initCarousel() {
  document.getElementById("carouselPrev")?.addEventListener("click", () => {
    if (carouselIndex > 0) {
      carouselIndex--;
      updateCarousel();
    }
  });

  document.getElementById("carouselNext")?.addEventListener("click", () => {
    const track = document.getElementById("carouselTrack");
    if (!track) return;

    const slides = track.querySelectorAll(".carousel-slide");
    if (slides.length === 0) return;

    const slideWidth = slides[0].offsetWidth + 20;
    const maxIndex = Math.max(0, slides.length - Math.floor(track.offsetWidth / slideWidth));

    if (carouselIndex < maxIndex) {
      carouselIndex++;
      updateCarousel();
    }
  });

  window.addEventListener("resize", updateCarousel);
}

function initSearch() {
  const heroSearchForm = document.getElementById("heroSearchForm");

  if (heroSearchForm) {
    heroSearchForm.onsubmit = e => {
      e.preventDefault();

      const query = document.getElementById("heroSearch")?.value || "";
      const catalogSearch = document.getElementById("catalogSearch");

      if (catalogSearch) catalogSearch.value = query;

      showView("marketplace");
      renderProducts();
    };
  }

  const catalogSearchForm = document.getElementById("catalogSearchForm");

  if (catalogSearchForm) {
    catalogSearchForm.onsubmit = e => {
      e.preventDefault();
      renderProducts();
    };
  }

  const categoryFilter = document.getElementById("categoryFilter");

  if (categoryFilter) {
    categoryFilter.onchange = () => {
      visibleCount = 6;
      renderProducts();
    };
  }

  const sortFilter = document.getElementById("sortFilter");

  if (sortFilter) {
    sortFilter.onchange = () => {
      renderProducts();
    };
  }

  const resetFilters = document.getElementById("resetFilters");

  if (resetFilters) {
    resetFilters.onclick = () => {
      document.getElementById("catalogSearch").value = "";
      document.getElementById("categoryFilter").value = "All";
      document.getElementById("sortFilter").value = "featured";
      visibleCount = 6;
      renderProducts();
    };
  }

  const loadMoreBtn = document.getElementById("loadMoreBtn");

  if (loadMoreBtn) {
    loadMoreBtn.onclick = () => {
      visibleCount += 6;
      renderProducts();
    };
  }

  const backToCatalog = document.getElementById("backToCatalog");

  if (backToCatalog) {
    backToCatalog.onclick = () => showView("marketplace");
  }
}

function initInquiry() {
  const inquiryForm = document.getElementById("inquiryForm");

  if (inquiryForm) {
    inquiryForm.onsubmit = e => {
      e.preventDefault();

      const successBanner = document.getElementById("formSuccess");

      if (successBanner) {
        successBanner.classList.remove("hidden");

        setTimeout(() => {
          successBanner.classList.add("hidden");
        }, 6000);
      }

      inquiryForm.reset();
    };
  }
}

// =====================================================
// STARTUP
// =====================================================
function initMainNavigation() {
  if (window.__sumanviNavigationReady) return;
  window.__sumanviNavigationReady = true;

  document.addEventListener("click", event => {
    const button = event.target.closest(".nav-btn, .mobile-nav");
    if (!button) return;

    const view = button.dataset.view;
    if (!view) return;

    event.preventDefault();
    showView(view);
  });
}

async function initApp() {
  initMainNavigation();

  try {
    initTheme();
  } catch (error) {
    console.error("Theme initialization error:", error);
  }

  try {
    initMobileMenu();
  } catch (error) {
    console.error("Mobile menu initialization error:", error);
  }

  try {
    initSearch();
  } catch (error) {
    console.error("Search initialization error:", error);
  }

  try {
    initInquiry();
  } catch (error) {
    console.error("Inquiry initialization error:", error);
  }

  try {
    initWhatsAppCommunityPopup();
  } catch (error) {
    console.error("WhatsApp Community popup initialization error:", error);
  }

  try {
    initDashboard();
  } catch (error) {
    console.error("Dashboard initialization error:", error);
  }

  try {
    initAdminAuth();
  } catch (error) {
    console.error("Admin authentication initialization error:", error);
  }

  try {
    initImagePreviews();
  } catch (error) {
    console.error("Image preview initialization error:", error);
  }

  const onBlogPage = !!document.getElementById("blogsGrid");

  if (onBlogPage) {
    try {
      await loadPublicBlogs();
    } catch (error) {
      console.error("Blog loading error:", error);
    }

    const backBtn = document.getElementById("backToBlogsList");
    if (backBtn) backBtn.onclick = hideBlogDetail;

    return;
  }

  try {
    await loadProducts();
  } catch (error) {
    console.error("Product loading error:", error);
  }

  try {
    initCarousel();
  } catch (error) {
    console.error("Carousel initialization error:", error);
  }

  const trigger = document.querySelector('[data-view-trigger="marketplace"]');
  if (trigger) trigger.onclick = () => showView("marketplace");

  const featuredViewMore = document.getElementById("featuredViewMore");
  if (featuredViewMore) featuredViewMore.onclick = () => showView("marketplace");

  const footerTermsLink = document.getElementById("footerTermsLink");
  if (footerTermsLink) footerTermsLink.onclick = () => showView("terms");

  const backFromTerms = document.getElementById("backFromTerms");
  if (backFromTerms) backFromTerms.onclick = () => showView("home");

  try {
    const admin = await checkAdminSession();
    isAdmin = admin;

    if (admin) await loadAdminData();
  } catch (error) {
    console.error("Admin session check error:", error);
    isAdmin = false;
  }

  try {
    showView(currentView);
  } catch (error) {
    console.error("Initial view error:", error);
  }
}

// =====================================================
// START APPLICATION ONLY ONCE
// =====================================================
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  initApp();
}
