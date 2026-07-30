/* =====================================================================
   CTDS — Auth helpers (depends on js/supabase-config.js → window.sb)
   ===================================================================== */
(function () {
  const sb = window.sb;

  const CTDS = {
    /* Create an account. `profile` is stored as user metadata and copied
       into the members table by the on_auth_user_created trigger. */
    async signUp({ email, password, profile }) {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: profile,
          emailRedirectTo: window.location.origin + "/login.html",
        },
      });
      return { data, error };
    },

    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      return { data, error };
    },

    async signOut() {
      await sb.auth.signOut();
      window.location.href = "index.html";
    },

    async getSession() {
      const { data } = await sb.auth.getSession();
      return data.session;
    },

    /* Redirect to login if there is no active session. Call at top of
       any members-only page. */
    async requireAuth(redirect = "login.html") {
      const session = await CTDS.getSession();
      if (!session) {
        window.location.href = redirect + "?next=" +
          encodeURIComponent(window.location.pathname.split("/").pop());
        return null;
      }
      return session;
    },

    /* Fetch the logged-in member's profile row. */
    async getMember() {
      const session = await CTDS.getSession();
      if (!session) return null;
      const { data, error } = await sb
        .from("members")
        .select("*")
        .eq("id", session.user.id)
        .single();
      if (error) return null;
      return data;
    },

    /* Swap the nav "Member Login" CTA to "My Account" when signed in.
       Add data-nav-cta to the nav link to enable this on any page. */
    async refreshNav() {
      const cta = document.querySelector("[data-nav-cta]");
      if (!cta) return;
      const session = await CTDS.getSession();
      if (session) {
        cta.textContent = "My Account";
        cta.href = "dashboard.html";
      } else {
        cta.textContent = "Member Login";
        cta.href = "login.html";
      }
    },
  };

  window.CTDS = CTDS;
  document.addEventListener("DOMContentLoaded", CTDS.refreshNav);
})();