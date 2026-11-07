// Lobby configuration.
// cloudUrl: the deployed cyberguard cloud API (no trailing slash). Leave empty
// for practice mode: players still play, flags are checked by their local
// agent, and nothing is sent anywhere. Set it once the API is hosted, and set
// the same URL as the CLOUD_URL default in ctf/docker-compose.yml.
window.CTF_CONFIG = {
  cloudUrl: "",
  agentUrl: "http://127.0.0.1:8071",
  challengeUrl: "http://127.0.0.1:8070/",
};
