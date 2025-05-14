import path from "path";
import express from "express";
import { fileURLToPath } from "url";

// Lấy __dirname chuẩn trong ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configViewEngine = (app) => {
  app.set("views", path.join(__dirname, "../views"));
  app.set("view engine", "ejs");

  // config static file
  app.use(express.static(path.join(__dirname, "../public")));
};

export default configViewEngine;
