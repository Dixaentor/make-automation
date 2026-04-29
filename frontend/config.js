window.EZONE_CONFIG = {
  CLOUDINARY: {
    cloud_name:    "dp2gg2xss",
    upload_preset: "ez_one_candidatures",
    folder:        "candidatures",
  },

  // Limites cote client (validation avant upload)
  LIMITS: {
    cv_max_mb:         25,   // PDF
    video_max_mb:      100,  // limite Cloudinary single-shot (chunked au-dela)
    video_max_seconds: 90,   // marge sur "1 min"
  },
};
