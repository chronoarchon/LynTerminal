use crate::commands::{get_settings_internal, AppState};
use crate::models::{PrinterDeviceInfo, ReceiptPrintLine, ReceiptPrintPayload, Settings};
use std::io::Write;
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::sync::Mutex;
use std::time::Duration;
use tauri::State;

pub const ESC_INIT: [u8; 2] = [0x1B, 0x40];
pub const ESC_ALIGN_LEFT: [u8; 3] = [0x1B, 0x61, 0x00];
pub const ESC_ALIGN_CENTER: [u8; 3] = [0x1B, 0x61, 0x01];
pub const ESC_BOLD_ON: [u8; 3] = [0x1B, 0x45, 0x01];
pub const ESC_BOLD_OFF: [u8; 3] = [0x1B, 0x45, 0x00];
pub const ESC_SIZE_NORMAL: [u8; 3] = [0x1D, 0x21, 0x00];
pub const ESC_SIZE_DOUBLE_H: [u8; 3] = [0x1D, 0x21, 0x01];
pub const GS_CUT_PARTIAL: [u8; 4] = [0x1D, 0x56, 0x42, 0x00];
pub const ESC_DRAWER_PULSE: [u8; 5] = [0x1B, 0x70, 0x00, 0x19, 0xFA];

pub fn sanitize_escpos_text(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '₹' => out.push_str("Rs."),
            '€' => out.push_str("EUR "),
            '£' => out.push_str("GBP "),
            '¥' => out.push_str("JPY "),
            '₱' => out.push_str("PHP "),
            '฿' => out.push_str("THB "),
            '–' | '—' | '−' => out.push('-'),
            '’' | '‘' => out.push('\''),
            '“' | '”' => out.push('"'),
            '\r' | '\n' => out.push(' '),
            c if c.is_ascii() && !c.is_ascii_control() => out.push(c),
            _ => out.push('?'),
        }
    }
    out
}

pub fn currency_decimals(code: &str) -> usize {
    match code.trim().to_uppercase().as_str() {
        "JPY" | "KRW" | "VND" | "IDR" | "HUF" | "CLP" | "PYG" => 0,
        _ => 2,
    }
}

pub fn escpos_currency_label(symbol: &str, code: &str) -> String {
    let trimmed = symbol.trim();
    if trimmed == "₹" {
        return "Rs.".into();
    }
    let clean = sanitize_escpos_text(trimmed);
    if clean.is_empty() || clean.chars().all(|c| c == '?') {
        let code_clean = sanitize_escpos_text(code);
        if code_clean.is_empty() { "$".into() } else { format!("{} ", code_clean) }
    } else {
        clean
    }
}

fn pad_two_col(left: &str, right: &str, width: usize) -> String {
    let l = sanitize_escpos_text(left);
    let r = sanitize_escpos_text(right);
    if l.len() + r.len() + 1 <= width {
        let spaces = width - l.len() - r.len();
        format!("{}{}{}", l, " ".repeat(spaces), r)
    } else {
        let max_left = width.saturating_sub(r.len() + 1);
        let trunc: String = l.chars().take(max_left).collect();
        let spaces = width.saturating_sub(trunc.len() + r.len());
        format!("{}{}{}", trunc, " ".repeat(spaces), r)
    }
}

fn wrap_text(text: &str, width: usize) -> Vec<String> {
    let clean = sanitize_escpos_text(text);
    if clean.is_empty() {
        return vec![];
    }
    let mut lines = Vec::new();
    let mut current = String::new();
    for word in clean.split_whitespace() {
        if current.is_empty() {
            if word.len() <= width {
                current.push_str(word);
            } else {
                for chunk in word.as_bytes().chunks(width) {
                    lines.push(String::from_utf8_lossy(chunk).to_string());
                }
            }
        } else if current.len() + 1 + word.len() <= width {
            current.push(' ');
            current.push_str(word);
        } else {
            lines.push(current);
            current = String::new();
            if word.len() <= width {
                current.push_str(word);
            } else {
                for chunk in word.as_bytes().chunks(width) {
                    let part = String::from_utf8_lossy(chunk).to_string();
                    if part.len() == width {
                        lines.push(part);
                    } else {
                        current = part;
                    }
                }
            }
        }
    }
    if !current.is_empty() {
        lines.push(current);
    }
    lines
}

pub fn format_escpos_receipt(settings: &Settings, payload: &ReceiptPrintPayload) -> Vec<u8> {
    let width_mode = payload
        .paper_width
        .as_deref()
        .unwrap_or(&settings.paper_width);
    let cols: usize = if width_mode.trim().eq_ignore_ascii_case("58mm") {
        32
    } else {
        48
    };
    let divider = "-".repeat(cols);
    let cur = escpos_currency_label(&settings.currency_symbol, &settings.currency_code);
    let dec = currency_decimals(&settings.currency_code);
    let mut buf: Vec<u8> = Vec::with_capacity(1024);

    // Initialize printer
    buf.extend_from_slice(&ESC_INIT);

    // Header
    buf.extend_from_slice(&ESC_ALIGN_CENTER);
    buf.extend_from_slice(&ESC_BOLD_ON);
    buf.extend_from_slice(&ESC_SIZE_DOUBLE_H);
    for line in wrap_text(&settings.business_name, cols) {
        buf.extend_from_slice(line.as_bytes());
        buf.push(b'\n');
    }
    buf.extend_from_slice(&ESC_SIZE_NORMAL);
    buf.extend_from_slice(&ESC_BOLD_OFF);

    if !settings.tagline.trim().is_empty() {
        for line in wrap_text(&settings.tagline, cols) {
            buf.extend_from_slice(line.as_bytes());
            buf.push(b'\n');
        }
    }
    if !settings.address.trim().is_empty() {
        for line in wrap_text(&settings.address, cols) {
            buf.extend_from_slice(line.as_bytes());
            buf.push(b'\n');
        }
    }
    if !settings.phone.trim().is_empty() {
        let ph = format!("Ph: {}", sanitize_escpos_text(&settings.phone));
        buf.extend_from_slice(ph.as_bytes());
        buf.push(b'\n');
    }
    if let Some(ref g) = payload.gstin {
        if !g.trim().is_empty() {
            let gst_line = format!("GSTIN: {}", sanitize_escpos_text(g));
            buf.extend_from_slice(gst_line.as_bytes());
            buf.push(b'\n');
        }
    } else if !settings.tax_id.trim().is_empty() {
        let tid = format!("Tax ID: {}", sanitize_escpos_text(&settings.tax_id));
        buf.extend_from_slice(tid.as_bytes());
        buf.push(b'\n');
    }

    // Meta block
    buf.extend_from_slice(&ESC_ALIGN_LEFT);
    buf.extend_from_slice(divider.as_bytes());
    buf.push(b'\n');

    let doc_label = if payload.invoice_type.eq_ignore_ascii_case("PURCHASE") {
        "PURCHASE BILL"
    } else {
        "TAX / POS RECEIPT"
    };
    buf.extend_from_slice(&ESC_BOLD_ON);
    buf.extend_from_slice(pad_two_col(doc_label, &payload.invoice_number, cols).as_bytes());
    buf.push(b'\n');
    buf.extend_from_slice(&ESC_BOLD_OFF);
    buf.extend_from_slice(pad_two_col("Date:", &payload.invoice_date, cols).as_bytes());
    buf.push(b'\n');
    buf.extend_from_slice(pad_two_col("Party:", &payload.party_name, cols).as_bytes());
    buf.push(b'\n');
    buf.extend_from_slice(pad_two_col("Mode:", &payload.payment_method, cols).as_bytes());
    buf.push(b'\n');

    buf.extend_from_slice(divider.as_bytes());
    buf.push(b'\n');

    // Items Header
    buf.extend_from_slice(&ESC_BOLD_ON);
    buf.extend_from_slice(pad_two_col("Item / Qty x Rate", "Amount", cols).as_bytes());
    buf.push(b'\n');
    buf.extend_from_slice(&ESC_BOLD_OFF);
    buf.extend_from_slice(divider.as_bytes());
    buf.push(b'\n');

    // Line items
    for item in &payload.items {
        for name_line in wrap_text(&item.name, cols) {
            buf.extend_from_slice(name_line.as_bytes());
            buf.push(b'\n');
        }
        let qty_str = if (item.quantity - item.quantity.round()).abs() < 0.001 {
            format!("{:.0}", item.quantity)
        } else {
            format!("{:.2}", item.quantity)
        };
        let left_detail = format!("  {} x {}{:.prec$}", qty_str, cur, item.unit_price, prec = dec);
        let right_amt = format!("{}{:.prec$}", cur, item.line_total, prec = dec);
        buf.extend_from_slice(pad_two_col(&left_detail, &right_amt, cols).as_bytes());
        buf.push(b'\n');
    }

    buf.extend_from_slice(divider.as_bytes());
    buf.push(b'\n');

    // Totals
    buf.extend_from_slice(
        pad_two_col("Subtotal:", &format!("{}{:.prec$}", cur, payload.subtotal, prec = dec), cols).as_bytes(),
    );
    buf.push(b'\n');
    if payload.discount_amount.abs() >= 0.005 {
        buf.extend_from_slice(
            pad_two_col("Discount:", &format!("-{}{:.prec$}", cur, payload.discount_amount, prec = dec), cols).as_bytes(),
        );
        buf.push(b'\n');
    }
    if payload.tax_amount.abs() >= 0.005 {
        let tax_lbl = format!("{}:", sanitize_escpos_text(&settings.tax_name));
        buf.extend_from_slice(
            pad_two_col(&tax_lbl, &format!("{}{:.prec$}", cur, payload.tax_amount, prec = dec), cols).as_bytes(),
        );
        buf.push(b'\n');
    }
    if payload.round_off.abs() >= 0.005 {
        let sign = if payload.round_off >= 0.0 { "+" } else { "-" };
        buf.extend_from_slice(
            pad_two_col("Round Off:", &format!("{}{}{:.prec$}", sign, cur, payload.round_off.abs(), prec = dec), cols).as_bytes(),
        );
        buf.push(b'\n');
    }

    buf.extend_from_slice(divider.as_bytes());
    buf.push(b'\n');

    buf.extend_from_slice(&ESC_BOLD_ON);
    buf.extend_from_slice(&ESC_SIZE_DOUBLE_H);
    buf.extend_from_slice(
        pad_two_col("TOTAL:", &format!("{}{:.prec$}", cur, payload.total_amount, prec = dec), cols).as_bytes(),
    );
    buf.push(b'\n');
    buf.extend_from_slice(&ESC_SIZE_NORMAL);
    buf.extend_from_slice(&ESC_BOLD_OFF);

    buf.extend_from_slice(
        pad_two_col("Paid:", &format!("{}{:.prec$}", cur, payload.paid_amount, prec = dec), cols).as_bytes(),
    );
    buf.push(b'\n');
    let due = (payload.total_amount - payload.paid_amount).max(0.0);
    if due >= 0.01 {
        buf.extend_from_slice(
            pad_two_col("Balance Due:", &format!("{}{:.prec$}", cur, due, prec = dec), cols).as_bytes(),
        );
        buf.push(b'\n');
    }

    buf.extend_from_slice(divider.as_bytes());
    buf.push(b'\n');

    // Footer
    buf.extend_from_slice(&ESC_ALIGN_CENTER);
    if let Some(ref notes) = payload.notes {
        if !notes.trim().is_empty() {
            for line in wrap_text(notes, cols) {
                buf.extend_from_slice(line.as_bytes());
                buf.push(b'\n');
            }
        }
    }
    if !settings.terms_and_conditions.trim().is_empty() {
        for line in wrap_text(&settings.terms_and_conditions, cols) {
            buf.extend_from_slice(line.as_bytes());
            buf.push(b'\n');
        }
    }
    buf.extend_from_slice(b"Thank you! Powered by LynTerminal\n\n\n");

    if settings.auto_cut {
        buf.extend_from_slice(&GS_CUT_PARTIAL);
    }

    let trigger_drawer = payload.open_drawer.unwrap_or(settings.open_cash_drawer);
    if trigger_drawer {
        buf.extend_from_slice(&ESC_DRAWER_PULSE);
    }

    buf
}

fn validate_serial_or_usb_target(target: &str) -> Result<String, String> {
    let trimmed = target.trim();
    if trimmed.is_empty() || trimmed.contains("..") {
        return Err("Invalid printer port/device path".into());
    }

    #[cfg(target_os = "windows")]
    {
        let upper = trimmed.to_uppercase();
        if upper.starts_with("COM") && upper[3..].chars().all(|c| c.is_ascii_digit()) {
            let num: u32 = upper[3..].parse().unwrap_or(0);
            if num == 0 {
                return Err("Invalid COM port number".into());
            }
            return Ok(if num >= 10 {
                format!("\\\\.\\{}", upper)
            } else {
                upper
            });
        }
        if upper.starts_with("LPT") && upper[3..].chars().all(|c| c.is_ascii_digit()) {
            return Ok(upper);
        }
        if upper.starts_with("\\\\.\\") && !trimmed.contains("..") {
            return Ok(trimmed.to_string());
        }
        return Err(format!("Unsupported Windows device path: {}", trimmed));
    }

    #[cfg(not(target_os = "windows"))]
    {
        if (trimmed.starts_with("/dev/usb/")
            || trimmed.starts_with("/dev/ttyUSB")
            || trimmed.starts_with("/dev/ttyACM")
            || trimmed.starts_with("/dev/ttyS")
            || trimmed.starts_with("/dev/lp")
            || trimmed.starts_with("/dev/cu.")
            || trimmed.starts_with("/dev/tty."))
            && !trimmed.contains("..")
        {
            Ok(trimmed.to_string())
        } else {
            Err(format!("Unsupported Unix device path: {}", trimmed))
        }
    }
}

fn normalize_network_target(target: &str) -> Result<SocketAddr, String> {
    let trimmed = target.trim();
    if trimmed.is_empty() {
        return Err("Network printer IP/host is required (e.g. 192.168.1.100:9100)".into());
    }
    let with_port = if trimmed.contains(':') {
        trimmed.to_string()
    } else {
        format!("{}:9100", trimmed)
    };
    with_port
        .to_socket_addrs()
        .map_err(|e| format!("Invalid printer network address '{}': {}", with_port, e))?
        .next()
        .ok_or_else(|| format!("Could not resolve printer address '{}'", with_port))
}

#[cfg(target_os = "windows")]
mod win_raw_spool {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    #[repr(C)]
    #[allow(non_snake_case)]
    struct DOC_INFO_1W {
        pDocName: *const u16,
        pOutputFile: *const u16,
        pDatatype: *const u16,
    }

    #[link(name = "winspool")]
    unsafe extern "system" {
        fn OpenPrinterW(pPrinterName: *const u16, phPrinter: *mut *mut core::ffi::c_void, pDefault: *const core::ffi::c_void) -> i32;
        fn StartDocPrinterW(hPrinter: *mut core::ffi::c_void, Level: u32, pDocInfo: *const DOC_INFO_1W) -> u32;
        fn StartPagePrinter(hPrinter: *mut core::ffi::c_void) -> i32;
        fn WritePrinter(hPrinter: *mut core::ffi::c_void, pBuf: *const u8, cbBuf: u32, pcWritten: *mut u32) -> i32;
        fn EndPagePrinter(hPrinter: *mut core::ffi::c_void) -> i32;
        fn EndDocPrinter(hPrinter: *mut core::ffi::c_void) -> i32;
        fn ClosePrinter(hPrinter: *mut core::ffi::c_void) -> i32;
    }

    fn to_wide_null(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
    }

    pub fn send_raw_bytes(printer_name: &str, data: &[u8]) -> Result<(), String> {
        let wide_name = to_wide_null(printer_name);
        let wide_doc = to_wide_null("LynTerminal Receipt");
        let wide_raw = to_wide_null("RAW");

        unsafe {
            let mut h_printer: *mut core::ffi::c_void = core::ptr::null_mut();
            if OpenPrinterW(wide_name.as_ptr(), &mut h_printer, core::ptr::null()) == 0 || h_printer.is_null() {
                return Err(format!("Failed to open Windows printer '{}'", printer_name));
            }

            let doc_info = DOC_INFO_1W {
                pDocName: wide_doc.as_ptr(),
                pOutputFile: core::ptr::null(),
                pDatatype: wide_raw.as_ptr(),
            };

            let job_id = StartDocPrinterW(h_printer, 1, &doc_info);
            if job_id == 0 {
                ClosePrinter(h_printer);
                return Err(format!("StartDocPrinterW failed for '{}'", printer_name));
            }

            if StartPagePrinter(h_printer) == 0 {
                EndDocPrinter(h_printer);
                ClosePrinter(h_printer);
                return Err(format!("StartPagePrinter failed for '{}'", printer_name));
            }

            let mut written: u32 = 0;
            let write_ok = WritePrinter(h_printer, data.as_ptr(), data.len() as u32, &mut written);

            EndPagePrinter(h_printer);
            EndDocPrinter(h_printer);
            ClosePrinter(h_printer);

            if write_ok == 0 || (written as usize) < data.len() {
                return Err(format!(
                    "WritePrinter wrote {} of {} bytes to '{}'",
                    written,
                    data.len(),
                    printer_name
                ));
            }
        }
        Ok(())
    }
}

pub fn send_raw_bytes(printer_type: &str, printer_target: &str, data: &[u8]) -> Result<String, String> {
    let mode = printer_type.trim().to_uppercase();
    match mode.as_str() {
        "BROWSER_DIALOG" | "" => Err("Printer is configured for Browser / PDF Print Dialog".into()),
        "NETWORK_9100" => {
            let addr = normalize_network_target(printer_target)?;
            let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(3))
                .map_err(|e| format!("Failed to connect to network printer {}: {}", addr, e))?;
            stream
                .set_write_timeout(Some(Duration::from_secs(3)))
                .ok();
            stream
                .write_all(data)
                .map_err(|e| format!("Network write failed: {}", e))?;
            stream.flush().ok();
            Ok(format!("Sent {} bytes to TCP printer {}", data.len(), addr))
        }
        "SERIAL" => {
            let port_path = validate_serial_or_usb_target(printer_target)?;
            let mut file = std::fs::OpenOptions::new()
                .write(true)
                .open(&port_path)
                .map_err(|e| format!("Failed to open serial port '{}': {}", port_path, e))?;
            file.write_all(data)
                .map_err(|e| format!("Serial write failed on '{}': {}", port_path, e))?;
            file.flush().ok();
            Ok(format!("Sent {} bytes to serial port {}", data.len(), port_path))
        }
        "USB_RAW" => {
            #[cfg(not(target_os = "windows"))]
            {
                let dev_path = validate_serial_or_usb_target(printer_target)?;
                let mut file = std::fs::OpenOptions::new()
                    .write(true)
                    .open(&dev_path)
                    .map_err(|e| format!("Failed to open USB raw device '{}': {}", dev_path, e))?;
                file.write_all(data)
                    .map_err(|e| format!("USB raw write failed on '{}': {}", dev_path, e))?;
                file.flush().ok();
                Ok(format!("Sent {} bytes to USB device {}", data.len(), dev_path))
            }
            #[cfg(target_os = "windows")]
            {
                if printer_target.trim().starts_with("\\\\.\\") {
                    let dev_path = validate_serial_or_usb_target(printer_target)?;
                    let mut file = std::fs::OpenOptions::new()
                        .write(true)
                        .open(&dev_path)
                        .map_err(|e| format!("Failed to open USB raw device '{}': {}", dev_path, e))?;
                    file.write_all(data)
                        .map_err(|e| format!("USB raw write failed on '{}': {}", dev_path, e))?;
                    file.flush().ok();
                    Ok(format!("Sent {} bytes to USB device {}", data.len(), dev_path))
                } else {
                    // On Windows, standard USB thermal printers use the Windows Print Spooler RAW queue
                    if printer_target.trim().is_empty() {
                        return Err("Printer name or device path is required".into());
                    }
                    win_raw_spool::send_raw_bytes(printer_target.trim(), data)?;
                    Ok(format!("Sent {} raw bytes via Windows Spooler to '{}'", data.len(), printer_target.trim()))
                }
            }
        }
        "OS_SPOOLER" => {
            let target = printer_target.trim();
            if target.is_empty() {
                return Err("OS printer name is required".into());
            }
            #[cfg(target_os = "windows")]
            {
                win_raw_spool::send_raw_bytes(target, data)?;
                Ok(format!("Sent {} raw bytes to Windows printer '{}'", data.len(), target))
            }
            #[cfg(not(target_os = "windows"))]
            {
                use std::process::{Command, Stdio};
                let mut child = Command::new("lp")
                    .args(["-d", target, "-o", "raw"])
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .map_err(|e| format!("Failed to invoke CUPS 'lp' command: {}", e))?;
                if let Some(mut stdin) = child.stdin.take() {
                    stdin
                        .write_all(data)
                        .map_err(|e| format!("Failed writing ESC/POS bytes to lp stdin: {}", e))?;
                }
                let output = child.wait_with_output().map_err(|e| e.to_string())?;
                if !output.status.success() {
                    let err_msg = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("CUPS lp failed: {}", err_msg.trim()));
                }
                Ok(format!("Sent {} raw bytes to CUPS printer '{}'", data.len(), target))
            }
        }
        other => Err(format!("Unsupported printer_type '{}'", other)),
    }
}

pub fn list_printers_internal() -> Result<Vec<PrinterDeviceInfo>, String> {
    let mut devices = Vec::new();
    let platform = std::env::consts::OS.to_string();

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        if let Ok(output) = Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Get-Printer | Select-Object Name, Default | ConvertTo-Json -Compress",
            ])
            .output()
        {
            if output.status.success() {
                let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !raw.is_empty() {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) {
                        let items = match val {
                            serde_json::Value::Array(arr) => arr,
                            obj @ serde_json::Value::Object(_) => vec![obj],
                            _ => vec![],
                        };
                        for item in items {
                            if let Some(name) = item.get("Name").and_then(|v| v.as_str()) {
                                let is_def = item.get("Default").and_then(|v| v.as_bool()).unwrap_or(false);
                                devices.push(PrinterDeviceInfo {
                                    name: name.to_string(),
                                    printer_type: "OS_SPOOLER".into(),
                                    target: name.to_string(),
                                    is_default: is_def,
                                    platform: platform.clone(),
                                });
                            }
                        }
                    }
                }
            }
        }

        if let Ok(output) = Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "[System.IO.Ports.SerialPort]::GetPortNames() -join \"`n\"",
            ])
            .output()
        {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout);
                for line in text.lines() {
                    let port = line.trim();
                    if !port.is_empty() {
                        devices.push(PrinterDeviceInfo {
                            name: format!("Serial Port ({})", port),
                            printer_type: "SERIAL".into(),
                            target: port.to_string(),
                            is_default: false,
                            platform: platform.clone(),
                        });
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;

        let default_name = Command::new("lpstat")
            .arg("-d")
            .output()
            .ok()
            .and_then(|o| {
                let s = String::from_utf8_lossy(&o.stdout).to_string();
                s.split(':').nth(1).map(|n| n.trim().to_string())
            })
            .unwrap_or_default();

        if let Ok(output) = Command::new("lpstat").arg("-e").output() {
            if output.status.success() {
                let s = String::from_utf8_lossy(&output.stdout);
                for line in s.lines() {
                    let name = line.trim();
                    if !name.is_empty() {
                        devices.push(PrinterDeviceInfo {
                            name: name.to_string(),
                            printer_type: "OS_SPOOLER".into(),
                            target: name.to_string(),
                            is_default: !default_name.is_empty() && name == default_name,
                            platform: platform.clone(),
                        });
                    }
                }
            }
        }

        // Direct Linux USB & Serial thermal printer devices
        for dir in ["/dev/usb", "/dev"] {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.filter_map(Result::ok) {
                    let path_str = entry.path().to_string_lossy().to_string();
                    let fname = entry.file_name().to_string_lossy().to_string();
                    if (dir == "/dev/usb" && fname.starts_with("lp"))
                        || fname.starts_with("ttyUSB")
                        || fname.starts_with("ttyACM")
                    {
                        let ptype = if dir == "/dev/usb" { "USB_RAW" } else { "SERIAL" };
                        devices.push(PrinterDeviceInfo {
                            name: format!("Direct Device ({})", path_str),
                            printer_type: ptype.into(),
                            target: path_str,
                            is_default: false,
                            platform: platform.clone(),
                        });
                    }
                }
            }
        }
    }

    Ok(devices)
}

#[tauri::command]
pub fn list_printers() -> Result<Vec<PrinterDeviceInfo>, String> {
    list_printers_internal()
}

#[tauri::command]
pub fn print_raw_escpos(
    payload: ReceiptPrintPayload,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let settings = {
        let app = state.lock().map_err(|e| e.to_string())?;
        let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
        get_settings_internal(&conn)?
    };
    let bytes = format_escpos_receipt(&settings, &payload);
    send_raw_bytes(&settings.printer_type, &settings.printer_target, &bytes)
}

#[tauri::command]
pub fn test_print_receipt(
    printer_type: Option<String>,
    printer_target: Option<String>,
    paper_width: Option<String>,
    auto_cut: Option<bool>,
    open_cash_drawer_flag: Option<bool>,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let mut settings = {
        let app = state.lock().map_err(|e| e.to_string())?;
        let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
        get_settings_internal(&conn)?
    };

    if let Some(pt) = printer_type {
        settings.printer_type = pt;
    }
    if let Some(tgt) = printer_target {
        settings.printer_target = tgt;
    }
    if let Some(pw) = paper_width {
        settings.paper_width = pw;
    }
    if let Some(ac) = auto_cut {
        settings.auto_cut = ac;
    }
    if let Some(od) = open_cash_drawer_flag {
        settings.open_cash_drawer = od;
    }

    let sample = ReceiptPrintPayload {
        invoice_number: "TEST-0001".into(),
        invoice_date: chrono::Local::now().format("%Y-%m-%d %H:%M").to_string(),
        invoice_type: "SALE".into(),
        party_name: "Hardware Diagnostics".into(),
        payment_method: "Cash".into(),
        subtotal: 100.0,
        discount_amount: 0.0,
        tax_amount: 18.0,
        round_off: 0.0,
        total_amount: 118.0,
        paid_amount: 118.0,
        items: vec![ReceiptPrintLine {
            name: "Thermal Printer Alignment Test Item".into(),
            quantity: 1.0,
            unit_price: 100.0,
            line_total: 100.0,
            tax_rate: Some(18.0),
        }],
        gstin: None,
        notes: Some("ESC/POS hardware check successful".into()),
        paper_width: Some(settings.paper_width.clone()),
        open_drawer: Some(settings.open_cash_drawer),
    };

    let bytes = format_escpos_receipt(&settings, &sample);
    send_raw_bytes(&settings.printer_type, &settings.printer_target, &bytes)
}

#[tauri::command]
pub fn open_cash_drawer(
    printer_type: Option<String>,
    printer_target: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let settings = {
        let app = state.lock().map_err(|e| e.to_string())?;
        let conn = app.db.conn.lock().map_err(|e| e.to_string())?;
        get_settings_internal(&conn)?
    };
    let p_type = printer_type.unwrap_or(settings.printer_type);
    let p_target = printer_target.unwrap_or(settings.printer_target);
    let mut bytes = Vec::with_capacity(7);
    bytes.extend_from_slice(&ESC_INIT);
    bytes.extend_from_slice(&ESC_DRAWER_PULSE);
    send_raw_bytes(&p_type, &p_target, &bytes)
}
