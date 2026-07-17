document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Auth elements
  const userBtn = document.getElementById("user-btn");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const logoutBtn = document.getElementById("logout-btn");
  const cancelLoginBtn = document.getElementById("cancel-login-btn");
  const loginSubmitBtn = document.getElementById("login-submit-btn");
  const loggedInUser = document.getElementById("logged-in-user");
  const signupContainer = document.getElementById("signup-container");

  // --- Auth helpers ---
  function getToken() {
    return sessionStorage.getItem("auth_token");
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function updateAuthUI(username) {
    if (username) {
      loggedInUser.textContent = `👩‍🏫 ${username}`;
      loggedInUser.classList.remove("hidden");
      loginSubmitBtn.classList.add("hidden");
      logoutBtn.classList.remove("hidden");
      signupContainer.classList.remove("hidden");
    } else {
      loggedInUser.classList.add("hidden");
      loginSubmitBtn.classList.remove("hidden");
      logoutBtn.classList.add("hidden");
      signupContainer.classList.add("hidden");
    }
    // Re-render to show/hide delete buttons
    fetchActivities();
  }

  // Open modal
  userBtn.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
    loginError.classList.add("hidden");
    loginForm.reset();
  });

  // Close modal
  cancelLoginBtn.addEventListener("click", () => {
    loginModal.classList.add("hidden");
  });

  // Close modal on backdrop click
  loginModal.addEventListener("click", (e) => {
    if (e.target === loginModal) loginModal.classList.add("hidden");
  });

  // Handle login
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (response.ok) {
        sessionStorage.setItem("auth_token", result.access_token);
        loginModal.classList.add("hidden");
        updateAuthUI(username);
      } else {
        loginError.textContent = result.detail || "Login failed";
        loginError.classList.remove("hidden");
      }
    } catch {
      loginError.textContent = "Could not connect to server";
      loginError.classList.remove("hidden");
    }
  });

  // Handle logout
  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("auth_token");
    loginModal.classList.add("hidden");
    updateAuthUI(null);
  });

  // Check existing session on load
  async function checkSession() {
    const token = getToken();
    if (!token) {
      updateAuthUI(null);
      return;
    }
    try {
      const response = await fetch("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        updateAuthUI(data.username);
      } else {
        sessionStorage.removeItem("auth_token");
        updateAuthUI(null);
      }
    } catch {
      updateAuthUI(null);
    }
  }

  // Authorized fetch helper
  function authFetch(url, options = {}) {
    const token = getToken();
    if (token) {
      options.headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
    }
    return fetch(url, options);
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Only show delete buttons if the teacher is logged in
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        isLoggedIn()
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await authFetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await authFetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  checkSession();
});
