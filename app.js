
(function () {
  "use strict";

  var E = ""; // empty string

  function $(sel, ctx) {
    ctx = ctx || document;
    return ctx.querySelector(sel);
  }

  function $$(sel, ctx) {
    ctx = ctx || document;
    return Array.prototype.slice.call(ctx.querySelectorAll(sel));
  }

  function hashPassword(password) {
    var hash = 0;
    var str = "vg_salt_" + password + "_pepper";
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      hash = ((hash < 5) - hash) + ch;
      hash = hash & hash;
    }
    return "h_" + Math.abs(hash).toString(36);
  }

  function showToast(message, duration) {
    duration = duration || 3000;
    var toast = $("#toast");
    var toastMsg = $("#toastMessage");
    toastMsg.textContent = message;
    toast.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      toast.classList.remove("show");
    }, duration);
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ===================== THEME =====================
  var ThemeManager = {
    init: function () {
      var saved = localStorage.getItem("vg_theme");
      var theme = saved || "light";
      this.apply(theme);

      $("#themeToggle").addEventListener("click", function () {
        var current = document.documentElement.getAttribute("data-theme");
        var next = current === "light" ? "dark" : "light";
        ThemeManager.apply(next);
        localStorage.setItem("vg_theme", next);
      });
    },
    apply: function (theme) {
      document.documentElement.setAttribute("data-theme", theme);
    }
  };

  // ===================== AUTH =====================
  var Auth = {
    currentUser: null,

    init: function () {
      var saved = localStorage.getItem("vg_current_user");
      if (saved) {
        try {
          this.currentUser = JSON.parse(saved);
          this.updateUI();
        } catch (e) {
          localStorage.removeItem("vg_current_user");
        }
      }

      $("#signupBtn").addEventListener("click", function () {
        Auth.openModal("signup");
      });
      var msb = $("#mobileSignupBtn");
      if (msb) msb.addEventListener("click", function () { Auth.openModal("signup"); });
      $("#switchToSignup").addEventListener("click", function () {
        Auth.openModal("signup");
      });
      $("#signupForm").addEventListener("submit", function (e) {
        Auth.handleSignup(e);
      });

      $("#loginBtn").addEventListener("click", function () {
        Auth.openModal("login");
      });
      var mlb = $("#mobileLoginBtn");
      if (mlb) mlb.addEventListener("click", function () { Auth.openModal("login"); });
      $("#switchToLogin").addEventListener("click", function () {
        Auth.openModal("login");
      });
      $("#loginForm").addEventListener("submit", function (e) {
        Auth.handleLogin(e);
      });

      $("#loginClose").addEventListener("click", function () {
        Auth.closeModal("login");
      });
      $("#signupClose").addEventListener("click", function () {
        Auth.closeModal("signup");
      });

      $("#logoutBtn").addEventListener("click", function () {
        Auth.logout();
      });
      var molb = $("#mobileLogoutBtn");
      if (molb) molb.addEventListener("click", function () { Auth.logout(); });
      $("#dashboardLogoutBtn").addEventListener("click", function () {
        Auth.logout();
      });

      $("#dashboardBtn").addEventListener("click", function () {
        Auth.showDashboard();
      });
      $("#userAvatarBtn").addEventListener("click", function () {
        Auth.toggleDropdown();
      });

      document.addEventListener("click", function (e) {
        var menu = $("#userMenu");
        if (menu && !menu.contains(e.target)) {
          $("#userDropdown").classList.remove("open");
        }
      });

      $("#googleLoginBtn").addEventListener("click", function () {
        Auth.handleGoogleAuth();
      });
      $("#googleSignupBtn").addEventListener("click", function () {
        Auth.handleGoogleAuth();
      });

      // Welcome & Profile modal handlers
      $("#welcomeCloseBtn").addEventListener("click", function () {
        Auth.closeModal("welcome");
      });
      $("#profileClose").addEventListener("click", function () {
        Auth.closeModal("profile");
      });
      $("#profileSkipBtn").addEventListener("click", function () {
        Auth.closeModal("profile");
      });
      $("#profileForm").addEventListener("submit", function (e) {
        e.preventDefault();
        Auth.saveProfile();
      });

    },

    openModal: function (type) {
      this.closeAllModals();
      var modal = $("#" + type + "Modal");
      if (modal) {
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
        setTimeout(function () {
          var fi = modal.querySelector("input");
          if (fi) fi.focus();
        }, 300);
      }
    },

    closeModal: function (type) {
      var modal = $("#" + type + "Modal");
      if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = E;
        modal.querySelectorAll(".form-error").forEach(function (el) {
          el.textContent = E;
        });
        modal.querySelectorAll(".error").forEach(function (el) {
          el.classList.remove("error");
        });
        modal.querySelectorAll("form").forEach(function (f) {
          f.reset();
        });
      }
    },

    closeAllModals: function () {
      $$(".modal-overlay").forEach(function (m) {
        m.classList.remove("active");
      });
      document.body.style.overflow = E;
      $$(".form-error").forEach(function (el) {
        el.textContent = E;
      });
      $$(".error").forEach(function (el) {
        el.classList.remove("error");
      });
    },

    getUsers: function () {
      return JSON.parse(localStorage.getItem("vg_users") || "[]");
    },

    saveUsers: function (users) {
      localStorage.setItem("vg_users", JSON.stringify(users));
    },

    handleSignup: function (e) {
      e.preventDefault();
      var valid = true;

      var name = $("#signupName").value.trim();
      var email = $("#signupEmail").value.trim().toLowerCase();
      var password = $("#signupPassword").value;
      var confirm = $("#signupConfirmPassword").value;

      if (!name || name.length < 2) {
        this.showError("signupNameError", "Please enter your full name");
        $("#signupName").classList.add("error");
        valid = false;
      } else {
        this.clearError("signupNameError", "#signupName");
      }

      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        this.showError("signupEmailError", "Please enter a valid email");
        $("#signupEmail").classList.add("error");
        valid = false;
      } else {
        this.clearError("signupEmailError", "#signupEmail");
      }

      if (!password || password.length < 6) {
        this.showError("signupPasswordError", "Password must be at least 6 characters");
        $("#signupPassword").classList.add("error");
        valid = false;
      } else {
        this.clearError("signupPasswordError", "#signupPassword");
      }

      if (password !== confirm) {
        this.showError("signupConfirmError", "Passwords do not match");
        $("#signupConfirmPassword").classList.add("error");
        valid = false;
      } else {
        this.clearError("signupConfirmError", "#signupConfirmPassword");
      }

      if (!valid) return;

      var self = this;
      fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, email: email, password: password })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          self.showError("signupEmailError", data.error);
          $("#signupEmail").classList.add("error");
          return;
        }

        // Auto-login logic locally to maintain session state
        var user = {
          name: name,
          email: email,
          createdAt: new Date().toISOString()
        };
        self.currentUser = user;
        localStorage.setItem("vg_current_user", JSON.stringify(user));

        self.closeModal("signup");
        self.updateUI();
        $("#welcomeModal").classList.add("active");
        document.getElementById("welcomeTitle").textContent = "Welcome, " + user.name + "!";
        document.getElementById("welcomeMessage").textContent = "Thanks for joining ValueGrid.";
        showToast("Account created successfully! Welcome to ValueGrid.");
      })
      .catch(function () {
        self.showError("signupEmailError", "Network error. Please try again.");
      });
    },

    handleLogin: function (e) {
      e.preventDefault();
      var valid = true;

      var email = $("#loginEmail").value.trim().toLowerCase();
      var password = $("#loginPassword").value;

      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        this.showError("loginEmailError", "Please enter a valid email");
        $("#loginEmail").classList.add("error");
        valid = false;
      } else {
        this.clearError("loginEmailError", "#loginEmail");
      }

      if (!password) {
        this.showError("loginPasswordError", "Please enter your password");
        $("#loginPassword").classList.add("error");
        valid = false;
      } else {
        this.clearError("loginPasswordError", "#loginPassword");
      }

      if (!valid) return;

      var self = this;
      fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          self.showError("loginPasswordError", data.error);
          $("#loginPassword").classList.add("error");
          return;
        }

        self.currentUser = data.user;
        localStorage.setItem("vg_current_user", JSON.stringify(data.user));

        self.closeModal("login");
        self.updateUI();
        $("#welcomeModal").classList.add("active");
        document.getElementById("welcomeTitle").textContent = "Welcome Back, " + data.user.name + "!";
        document.getElementById("welcomeMessage").textContent = "Great to see you again, " + data.user.name + ".";
        showToast("Welcome back, " + data.user.name + "!");
      })
      .catch(function () {
        self.showError("loginPasswordError", "Network error. Please try again.");
      });
    },

    handleGoogleAuth: function () {
      var googleUser = {
        name: "Google User",
        email: "user@gmail.com"
      };

      var self = this;
      fetch("/api/google-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(googleUser)
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.user) {
          self.currentUser = data.user;
          localStorage.setItem("vg_current_user", JSON.stringify(data.user));
          self.closeAllModals();
          self.updateUI();
          showToast("Signed in with Google. Welcome, " + data.user.name + "!");
        }
      })
      .catch(function () {
        showToast("Google Auth failed. Try again.");
      });
    },

    logout: function () {
      this.currentUser = null;
      localStorage.removeItem("vg_current_user");
      this.updateUI();

      var dash = $("#dashboard-section");
      if (dash) dash.style.display = "none";
      this.showMainSections();
      window.scrollTo({ top: 0, behavior: "smooth" });
      showToast("Logged out successfully.");
    },

    updateUI: function () {
      var isLoggedIn = !!this.currentUser;
      var authButtons = $("#authButtons");
      var userMenu = $("#userMenu");
      var mobileAuth = $("#mobileAuthButtons");
      var mobileUserActions = $("#mobileUserActions");
      var dashLinks = $$(".nav-dashboard-link, .mobile-dashboard-link");

      if (isLoggedIn) {
        authButtons.style.display = "none";
        userMenu.style.display = "block";
        mobileAuth.style.display = "none";
        mobileUserActions.style.display = "flex";
        dashLinks.forEach(function (el) {
          el.style.display = E;
        });

        var initial = (this.currentUser.name || "U").charAt(0).toUpperCase();
        $("#userAvatar").textContent = initial;
        $("#dropdownName").textContent = this.currentUser.name;
        $("#dropdownEmail").textContent = this.currentUser.email;

        this.updateProfile();
        this.startProfileTimer();
      } else {
        authButtons.style.display = "flex";
        userMenu.style.display = "none";
        mobileAuth.style.display = "flex";
        mobileUserActions.style.display = "none";
        dashLinks.forEach(function (el) {
          el.style.display = "none";
        });
      }
    },

    updateProfile: function () {
      if (!this.currentUser) return;
      var u = this.currentUser;
      var initial = (u.name || "U").charAt(0).toUpperCase();

      $("#profileAvatar").textContent = initial;
      $("#profileName").textContent = u.name || "\u2014";
      $("#profileEmail").textContent = u.email || "\u2014";
      $("#profileFullName").textContent = u.name || "\u2014";
      $("#profileDetailEmail").textContent = u.email || "\u2014";
      $("#profilePhone").textContent = u.phone || "\u2014";
      $("#profileBusiness").textContent = u.businessName || "\u2014";
      $("#profileBusinessType").textContent = u.businessType || "\u2014";
      $("#profileLocation").textContent = u.location || "\u2014";
      $("#profileCreated").textContent = u.createdAt ? formatDate(u.createdAt) : "\u2014";
    },

    showDashboard: function () {
      if (!this.currentUser) return;
      $("#userDropdown").classList.remove("open");

      $$(".hero, .advisor-cta, .features, .reviews, .about, .plans, .portfolio").forEach(function (s) {
        s.style.display = "none";
      });
      $("#dashboard-section").style.display = "block";

      this.updateProfile();
      window.scrollTo({ top: 0, behavior: "smooth" });

      $$(".nav-link, .mobile-nav-link").forEach(function (l) {
        l.classList.remove("active");
      });
      $$(".nav-dashboard-link, .mobile-dashboard-link").forEach(function (l) {
        l.classList.add("active");
      });
    },

    showMainSections: function () {
      $$(".hero, .advisor-cta, .features, .reviews, .about, .plans, .portfolio").forEach(function (s) {
        s.style.display = E;
      });
      var dash = $("#dashboard-section");
      if (dash) dash.style.display = "none";
    },

    toggleDropdown: function () {
      $("#userDropdown").classList.toggle("open");
    },

    showError: function (id, msg) {
      var el = $("#" + id);
      if (el) el.textContent = msg;
    },

    clearError: function (id, inputSel) {
      var el = $("#" + id);
      if (el) el.textContent = E;
      if (inputSel) {
        var input = $(inputSel);
        if (input) input.classList.remove("error");
      }
    },

    profileTimer: null,

    startProfileTimer: function () {
      if (this.currentUser) {
        var u = this.currentUser;
        var incomplete = !u.phone || !u.businessName || !u.businessType || !u.location;
        if (incomplete) {
          if (this.profileTimer) clearTimeout(this.profileTimer);
          this.profileTimer = setTimeout(function() { Auth.showProfileModal(); }, 45000);
        }
      }
    },

    showProfileModal: function () {
      var u = this.currentUser;
      $("#profileInputPhone").value = u.phone || "";
      $("#profileInputBusiness").value = u.businessName || "";
      $("#profileInputBusinessType").value = u.businessType || "";
      $("#profileInputLocation").value = u.location || "";
      $("#profileModal").classList.add("active");
      document.body.style.overflow = "hidden";
    },

    saveProfile: function () {
      var phone = $("#profileInputPhone").value.trim();
      var business = $("#profileInputBusiness").value.trim();
      var type = $("#profileInputBusinessType").value.trim();
      var location = $("#profileInputLocation").value.trim();

      if (!phone || !business || !type || !location) {
        showToast("Please fill all fields or click Skip");
        return;
      }

      var user = this.currentUser;
      user.phone = phone;
      user.businessName = business;
      user.businessType = type;
      user.location = location;
      localStorage.setItem("vg_current_user", JSON.stringify(user));

      fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, phone, businessName: business, businessType: type, location })
      });

      this.updateProfile();
      this.closeModal("profile");
      showToast("Profile updated successfully!");
    }
  };

  // ===================== NAVIGATION =====================
  var Navigation = {
    init: function () {
      var self = this;

      $$(".nav-link").forEach(function (link) {
        link.addEventListener("click", function (e) {
          self.handleClick(e, link);
        });
      });

      $$(".mobile-nav-link").forEach(function (link) {
        link.addEventListener("click", function (e) {
          self.handleClick(e, link);
        });
      });

      $("#mobileMenuToggle").addEventListener("click", function () {
        self.toggleMobile();
      });

      window.addEventListener("scroll", function () {
        var header = $("#header");
        if (window.scrollY > 10) {
          header.classList.add("scrolled");
        } else {
          header.classList.remove("scrolled");
        }
      });

      $(".logo").addEventListener("click", function (e) {
        e.preventDefault();
        Auth.showMainSections();
        $$(".nav-link, .mobile-nav-link").forEach(function (l) {
          l.classList.remove("active");
        });
        $$('.nav-link[data-section="home"], .mobile-nav-link[data-section="home"]').forEach(function (l) {
          l.classList.add("active");
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
        self.closeMobile();
      });
    },

    handleClick: function (e, link) {
      e.preventDefault();
      var section = link.getAttribute("data-section");

      Auth.showMainSections();

      $$(".nav-link, .mobile-nav-link").forEach(function (l) {
        l.classList.remove("active");
      });
      var sel = '.nav-link[data-section="' + section + '"], .mobile-nav-link[data-section="' + section + '"]';
      $$(sel).forEach(function (l) {
        l.classList.add("active");
      });

      var target = $("#" + section);
      if (target) {
        var hh = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 70;
        window.scrollTo({ top: target.offsetTop - hh, behavior: "smooth" });
      }

      this.closeMobile();
    },

    toggleMobile: function () {
      $("#mobileMenuToggle").classList.toggle("active");
      $("#mobileNav").classList.toggle("open");
    },

    closeMobile: function () {
      $("#mobileMenuToggle").classList.remove("active");
      $("#mobileNav").classList.remove("open");
    }
  };

  // ===================== FEATURES =====================
  var Features = {
    services: [
      { icon: "\uD83C\uDF10", title: "Website Development" },
      { icon: "\uD83D\uDCF1", title: "Mobile-Friendly Websites" },
      { icon: "\uD83D\uDCCD", title: "Google Business Profile Setup" },
      { icon: "\uD83D\uDCF8", title: "Social Media Setup" },
      { icon: "\uD83C\uDF7D\uFE0F", title: "Digital Menus" },
      { icon: "\uD83D\uDED2", title: "Online Ordering" },
      { icon: "\uD83D\uDCB3", title: "Payment Integration" },
      { icon: "\uD83D\uDCC8", title: "Basic SEO" },
      { icon: "\uD83D\uDD27", title: "Website Maintenance" }
    ],

    init: function () {
      var grid = $("#featuresGrid");
      this.services.forEach(function (svc, i) {
        var card = document.createElement("div");
        card.className = "feature-card";
        card.style.animationDelay = (i * 0.05) + "s";
        card.innerHTML = '<span class="feature-icon">' + svc.icon + '</span><h3 class="feature-title">' + escapeHtml(svc.title) + '</h3>';
        grid.appendChild(card);
      });
    }
  };

  // ===================== REVIEWS =====================
  var Reviews = {
    selectedRating: 0,

    init: function () {
      var self = this;
      this.loadReviews();

      $("#addReviewBtn").addEventListener("click", function () {
        Auth.openModal("review");
      });

      $("#reviewClose").addEventListener("click", function () {
        Auth.closeModal("review");
      });

      $$(".star-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self.selectedRating = parseInt(btn.getAttribute("data-rating"));
          self.updateStars();
        });

        btn.addEventListener("mouseenter", function () {
          var rating = parseInt(btn.getAttribute("data-rating"));
          $$(".star-btn").forEach(function (s, i) {
            s.style.color = i < rating ? "var(--accent)" : "var(--border-color)";
          });
        });

        btn.addEventListener("mouseleave", function () {
          self.updateStars();
        });
      });

      $("#reviewForm").addEventListener("submit", function (e) {
        self.handleSubmit(e);
      });
    },

    updateStars: function () {
      var rating = this.selectedRating;
      $$(".star-btn").forEach(function (s, i) {
        if (i < rating) {
          s.classList.add("active");
        } else {
          s.classList.remove("active");
        }
        s.style.color = E;
      });
    },

    getReviews: function () {
      return fetch('/api/reviews')
        .then(function (r) { return r.json(); })
        .catch(function () { return []; });
    },

    loadReviews: function () {
      var self = this;
      var container = $("#reviewsContainer");

      this.getReviews().then(function (reviews) {
        if (!reviews || reviews.length === 0) {
          container.innerHTML = '<p class="no-reviews">No reviews yet. Be the first to share your experience!</p>';
          return;
        }

        container.innerHTML = E;
        reviews.sort(function (a, b) {
          return new Date(b.date) - new Date(a.date);
        });

        reviews.forEach(function (review) {
          var card = document.createElement("div");
          card.className = "review-card";
          var stars = E;
          for (var i = 0; i < 5; i++) {
            stars += i < review.rating ? "\u2605" : "\u2606";
          }
          card.innerHTML =
            '<div class="review-header"><span class="review-author">' + escapeHtml(review.name) + '</span><span class="review-date">' + formatDate(review.date) + '</span></div>' +
            '<div class="review-stars">' + stars + '</div>' +
            '<p class="review-text">' + escapeHtml(review.text) + '</p>';
          container.appendChild(card);
        });
      });
    },

    handleSubmit: function (e) {
      e.preventDefault();
      var valid = true;

      var name = $("#reviewName").value.trim();
      var text = $("#reviewText").value.trim();

      if (!name || name.length < 2) {
        $("#reviewNameError").textContent = "Please enter your name";
        $("#reviewName").classList.add("error");
        valid = false;
      } else {
        $("#reviewNameError").textContent = E;
        $("#reviewName").classList.remove("error");
      }

      if (this.selectedRating === 0) {
        $("#reviewRatingError").textContent = "Please select a rating";
        valid = false;
      } else {
        $("#reviewRatingError").textContent = E;
      }

      if (!text || text.length < 5) {
        $("#reviewTextError").textContent = "Please write a review (at least 5 characters)";
        $("#reviewText").classList.add("error");
        valid = false;
      } else {
        $("#reviewTextError").textContent = E;
        $("#reviewText").classList.remove("error");
      }

      if (!valid) return;

      var self = this;
      fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          rating: self.selectedRating,
          text: text
        })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          showToast(data.error);
          return;
        }
        self.loadReviews();
        Auth.closeModal("review");
        self.selectedRating = 0;
        self.updateStars();
        $("#reviewForm").reset();
        showToast("Review submitted successfully!");
      })
      .catch(function () {
        showToast("Network error. Please try again.");
      });
    }
  };

  // ===================== AI SUPPORT =====================
  var AISupport = {
    conversationCount: 0,
    knowledge: {
      services: "ValueGrid offers: Website Development, Mobile-Friendly Websites, Google Business Profile Setup, Social Media Setup, Digital Menus, Online Ordering, Payment Integration, Basic SEO, Website Maintenance, and Marketing & Customer Growth.",
      pricing: "Our plans are coming soon! We offer Starter, Growth, and Premium packages designed for small businesses. Stay tuned for affordable pricing.",
      contact: "You can reach us by phone at our business number or email us. You can also connect with one of our advisors directly through this chat.",
      about: "ValueGrid helps small businesses grow by bringing them online through affordable and practical digital solutions. We help local businesses, cafes, restaurants, and other offline businesses build their digital presence.",
      advisor: "If you need personalized help, click the 'Connect with One of Our Advisors' button below to request a callback from our team.",
      seo: "We provide Basic SEO as part of our services to help your business get found on Google and other search engines.",
      website: "We build professional, mobile-friendly websites for small businesses. Our websites are designed to convert visitors into customers.",
      social: "We set up and manage social media profiles for your business on platforms like Instagram, Facebook, and WhatsApp.",
      payment: "We integrate secure payment solutions so your customers can pay online easily.",
      hours: "Our AI support is available 24/7! For advisor consultations, we typically respond within 24 hours.",
      default: "I can help you with information about our services, pricing plans, and how to get started. You can also connect with one of our human advisors for personalized assistance."
    },

    init: function () {
      var self = this;

      $("#aiToggle").addEventListener("click", function () {
        self.toggleChat();
      });
      $("#aiClose").addEventListener("click", function () {
        self.closeChat();
      });
      $("#aiInputForm").addEventListener("submit", function (e) {
        e.preventDefault();
        self.sendMessage();
      });
      $("#connectAdvisorBtn").addEventListener("click", function () {
        self.closeChat();
        AdvisorContact.openModal();
      });
    },

    toggleChat: function () {
      var chat = $("#aiChat");
      chat.classList.toggle("open");
      if (chat.classList.contains("open")) {
        setTimeout(function () {
          $("#aiInput").focus();
        }, 300);
      }
    },

    closeChat: function () {
      $("#aiChat").classList.remove("open");
    },

    sendMessage: function () {
      var input = $("#aiInput");
      var text = input.value.trim();
      if (!text) return;

      this.addMessage(text, "user");
      input.value = E;

      var typing = this.addTypingIndicator();
      var self = this;

      setTimeout(function () {
        typing.remove();
        var response = self.getResponse(text);
        self.addMessage(response, "bot");
        self.conversationCount++;

        if (self.conversationCount >= 3) {
          $("#aiAdvisorPrompt").style.display = "block";
        }
      }, 600 + Math.random() * 800);
    },

    addMessage: function (text, type) {
      var container = $("#aiMessages");
      var msg = document.createElement("div");
      msg.className = "ai-message " + type;
      msg.innerHTML = "<p>" + escapeHtml(text) + "</p>";
      container.appendChild(msg);
      container.scrollTop = container.scrollHeight;
      return msg;
    },

    addTypingIndicator: function () {
      var container = $("#aiMessages");
      var typing = document.createElement("div");
      typing.className = "ai-message bot";
      typing.innerHTML = '<p style="opacity:0.5">Typing...</p>';
      container.appendChild(typing);
      container.scrollTop = container.scrollHeight;
      return typing;
    },

    getResponse: function (input) {
      var lower = input.toLowerCase();

      if (/\b(hi|hello|hey|greetings|namaste)\b/.test(lower)) {
        return "Hello! \uD83D\uDC4B Welcome to ValueGrid. How can I help you today?";
      }
      if (/\b(service|offer|provide|what do you|features)\b/.test(lower)) {
        return this.knowledge.services;
      }
      if (/\b(price|pricing|cost|plan|package|how much|rate)\b/.test(lower)) {
        return this.knowledge.pricing;
      }
      if (/\b(contact|reach|phone|call|email|talk)\b/.test(lower)) {
        return this.knowledge.contact;
      }
      if (/\b(about|who|what is|company|valuegrid)\b/.test(lower)) {
        return this.knowledge.about;
      }
      if (/\b(advisor|human|person|agent|representative|help me|real)\b/.test(lower)) {
        return this.knowledge.advisor;
      }
      if (/\b(seo|search engine|google ranking|rank)\b/.test(lower)) {
        return this.knowledge.seo;
      }
      if (/\b(website|site|web page|landing page)\b/.test(lower)) {
        return this.knowledge.website;
      }
      if (/\b(social|instagram|facebook|whatsapp|twitter)\b/.test(lower)) {
        return this.knowledge.social;
      }
      if (/\b(pay|payment|upi|card|online pay)\b/.test(lower)) {
        return this.knowledge.payment;
      }
      if (/\b(time|hour|when|available|open|close)\b/.test(lower)) {
        return this.knowledge.hours;
      }
      if (/\b(bye|thank|thanks|ok|great)\b/.test(lower)) {
        return "You're welcome! Feel free to ask if you have more questions. Have a great day! \uD83D\uDE0A";
      }
      return this.knowledge.default;
    }
  };

  // ===================== ADVISOR CONTACT =====================
  var AdvisorContact = {
    init: function () {
      var self = this;

      $("#advisorConnectBtn").addEventListener("click", function (e) {
        e.preventDefault();
        self.openModal();
      });

      $("#advisorModalClose").addEventListener("click", function () {
        Auth.closeModal("advisor");
      });

      $("#advisorForm").addEventListener("submit", function (e) {
        self.handleSubmit(e);
      });
    },

    openModal: function () {
      Auth.openModal("advisor");
      if (Auth.currentUser) {
        $("#advisorName").value = Auth.currentUser.name || E;
        $("#advisorEmail").value = Auth.currentUser.email || E;
      }
    },

    handleSubmit: function (e) {
      e.preventDefault();
      var valid = true;

      var name = $("#advisorName").value.trim();
      var email = $("#advisorEmail").value.trim();
      var message = $("#advisorMessage").value.trim();

      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!name || name.length < 2) {
        $("#advisorNameError").textContent = "Please enter your name";
        $("#advisorName").classList.add("error");
        valid = false;
      } else {
        $("#advisorNameError").textContent = E;
        $("#advisorName").classList.remove("error");
      }

      if (!email || !emailRegex.test(email)) {
        $("#advisorEmailError").textContent = "Please enter a valid email";
        $("#advisorEmail").classList.add("error");
        valid = false;
      } else {
        $("#advisorEmailError").textContent = E;
        $("#advisorEmail").classList.remove("error");
      }

      if (!message || message.length < 5) {
        $("#advisorMessageError").textContent = "Please enter a message (at least 5 characters)";
        $("#advisorMessage").classList.add("error");
        valid = false;
      } else {
        $("#advisorMessageError").textContent = E;
        $("#advisorMessage").classList.remove("error");
      }

      if (!valid) return;

      var requests = JSON.parse(localStorage.getItem("vg_advisor_requests") || "[]");
      requests.push({
        name: name,
        email: email,
        message: message,
        date: new Date().toISOString(),
        userId: Auth.currentUser ? Auth.currentUser.id : null
      });
      localStorage.setItem("vg_advisor_requests", JSON.stringify(requests));

      // In production: send email to PLACEHOLDER_SUPPORT_EMAIL
      console.log("[Advisor Request]", {
        name: name,
        email: email,
        message: message,
        recipient: "PLACEHOLDER_SUPPORT_EMAIL"
      });

      Auth.closeModal("advisor");
      showToast("Your request has been sent! Our advisor will contact you shortly.");
      $("#advisorForm").reset();
    }
  };

  // ===================== FORGOT PASSWORD =====================
  var ForgotPassword = {
    email: E,
    step: 1,

    init: function () {
      var self = this;

      // Open forgot password from login modal
      $("#forgotPasswordBtn").addEventListener("click", function () {
        Auth.closeModal("login");
        setTimeout(function () { self.open(); }, 300);
      });

      // Close
      $("#forgotClose").addEventListener("click", function () {
        self.close();
      });

      // Back to login
      $("#forgotBackToLogin").addEventListener("click", function () {
        self.close();
        setTimeout(function () { Auth.openModal("login"); }, 300);
      });

      // Step 1: Submit email
      $("#forgotEmailForm").addEventListener("submit", function (e) {
        e.preventDefault();
        self.handleEmailSubmit();
      });

      // Step 2: Submit OTP
      $("#forgotOtpForm").addEventListener("submit", function (e) {
        e.preventDefault();
        self.handleOtpSubmit();
      });

      // Step 2: Resend OTP
      $("#forgotResendOtp").addEventListener("click", function () {
        self.handleResendOtp();
      });

      // Step 3: Submit new password
      $("#forgotResetForm").addEventListener("submit", function (e) {
        e.preventDefault();
        self.handleResetSubmit();
      });

      // Step 4: Done → go to login
      $("#forgotDoneBtn").addEventListener("click", function () {
        self.close();
        setTimeout(function () { Auth.openModal("login"); }, 300);
      });
    },

    open: function () {
      this.goToStep(1);
      this.email = E;
      $("#forgotEmailForm").reset();
      $("#forgotOtpForm").reset();
      $("#forgotResetForm").reset();
      $("#forgotEmailError").textContent = E;
      $("#forgotOtpError").textContent = E;
      $("#forgotNewPasswordError").textContent = E;
      $("#forgotConfirmError").textContent = E;
      $("#forgotModal").classList.add("active");
      document.body.style.overflow = "hidden";
      setTimeout(function () { $("#forgotEmail").focus(); }, 300);
    },

    close: function () {
      $("#forgotModal").classList.remove("active");
      document.body.style.overflow = E;
    },

    goToStep: function (n) {
      this.step = n;
      for (var i = 1; i <= 4; i++) {
        $("#forgotStep" + i).style.display = i === n ? "block" : "none";
      }
    },

    handleEmailSubmit: function () {
      var email = $("#forgotEmail").value.trim().toLowerCase();
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!email || !emailRegex.test(email)) {
        $("#forgotEmailError").textContent = "Please enter a valid email";
        $("#forgotEmail").classList.add("error");
        return;
      }

      $("#forgotEmailError").textContent = E;
      $("#forgotEmail").classList.remove("error");
      $("#forgotSendBtn").disabled = true;
      $("#forgotSendBtn").textContent = "Sending...";

      var self = this;
      fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        $("#forgotSendBtn").disabled = false;
        $("#forgotSendBtn").textContent = "Send Verification Code";

        if (data.error) {
          $("#forgotEmailError").textContent = data.error;
          return;
        }

        self.email = email;
        $("#forgotEmailDisplay").textContent = email;
        self.goToStep(2);
        showToast(data.message);
        setTimeout(function () { $("#forgotOtp").focus(); }, 300);
      })
      .catch(function () {
        $("#forgotSendBtn").disabled = false;
        $("#forgotSendBtn").textContent = "Send Verification Code";
        $("#forgotEmailError").textContent = "Network error. Please try again.";
      });
    },

    handleResendOtp: function () {
      var self = this;
      if (!this.email) return;

      $("#forgotResendOtp").textContent = "Sending...";
      $("#forgotResendOtp").disabled = true;

      fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: this.email })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        $("#forgotResendOtp").textContent = "Resend Code";
        $("#forgotResendOtp").disabled = false;
        showToast(data.message || "Code resent!");
      })
      .catch(function () {
        $("#forgotResendOtp").textContent = "Resend Code";
        $("#forgotResendOtp").disabled = false;
        showToast("Failed to resend. Try again.");
      });
    },

    handleOtpSubmit: function () {
      var otp = $("#forgotOtp").value.trim();

      if (!otp || otp.length !== 6 || !/^\d+$/.test(otp)) {
        $("#forgotOtpError").textContent = "Please enter a valid 6-digit code";
        $("#forgotOtp").classList.add("error");
        return;
      }

      $("#forgotOtpError").textContent = E;
      $("#forgotOtp").classList.remove("error");
      $("#forgotVerifyBtn").disabled = true;
      $("#forgotVerifyBtn").textContent = "Verifying...";

      var self = this;
      fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: this.email, otp: otp })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        $("#forgotVerifyBtn").disabled = false;
        $("#forgotVerifyBtn").textContent = "Verify Code";

        if (data.error) {
          $("#forgotOtpError").textContent = data.error;
          return;
        }

        self.goToStep(3);
        showToast(data.message);
        setTimeout(function () { $("#forgotNewPassword").focus(); }, 300);
      })
      .catch(function () {
        $("#forgotVerifyBtn").disabled = false;
        $("#forgotVerifyBtn").textContent = "Verify Code";
        $("#forgotOtpError").textContent = "Network error. Please try again.";
      });
    },

    handleResetSubmit: function () {
      var newPw = $("#forgotNewPassword").value;
      var confirmPw = $("#forgotConfirmPassword").value;
      var valid = true;

      if (!newPw || newPw.length < 6) {
        $("#forgotNewPasswordError").textContent = "Password must be at least 6 characters";
        $("#forgotNewPassword").classList.add("error");
        valid = false;
      } else {
        $("#forgotNewPasswordError").textContent = E;
        $("#forgotNewPassword").classList.remove("error");
      }

      if (newPw !== confirmPw) {
        $("#forgotConfirmError").textContent = "Passwords do not match";
        $("#forgotConfirmPassword").classList.add("error");
        valid = false;
      } else {
        $("#forgotConfirmError").textContent = E;
        $("#forgotConfirmPassword").classList.remove("error");
      }

      if (!valid) return;

      $("#forgotResetBtn").disabled = true;
      $("#forgotResetBtn").textContent = "Resetting...";

      var self = this;
      fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: this.email, newPassword: newPw })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        $("#forgotResetBtn").disabled = false;
        $("#forgotResetBtn").textContent = "Reset Password";

        if (data.error) {
          $("#forgotNewPasswordError").textContent = data.error;
          return;
        }

        // Also update localStorage so the client-side auth stays in sync
        var users = JSON.parse(localStorage.getItem("vg_users") || "[]");
        for (var i = 0; i < users.length; i++) {
          if (users[i].email === self.email) {
            users[i].password = hashPassword(newPw);
            break;
          }
        }
        localStorage.setItem("vg_users", JSON.stringify(users));

        self.goToStep(4);
        showToast(data.message);
      })
      .catch(function () {
        $("#forgotResetBtn").disabled = false;
        $("#forgotResetBtn").textContent = "Reset Password";
        $("#forgotNewPasswordError").textContent = "Network error. Please try again.";
      });
    }
  };

  // ===================== SCROLL REVEAL =====================
  var ScrollReveal = {
    init: function () {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("revealed");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.05, rootMargin: "0px 0px -20px 0px" }
      );

      $$(".scroll-reveal").forEach(function (el) {
        observer.observe(el);
      });
    }
  };

  // ===================== INIT =====================
  document.addEventListener("DOMContentLoaded", function () {
    ThemeManager.init();
    Auth.init();
    Navigation.init();
    Features.init();
    Reviews.init();
    AISupport.init();
    AdvisorContact.init();
    ForgotPassword.init();
    ScrollReveal.init();
  });

})();
