using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("כלכלת הבית ומעשרות Pro")]
[assembly: AssemblyDescription("מערכת שולחנית לניהול תקציב, חיסכון ומעשרות")]
[assembly: AssemblyCompany("Budget & Maaser Pro")]
[assembly: AssemblyProduct("Budget & Maaser Pro Desktop")]
[assembly: AssemblyVersion("2.0.0.0")]
[assembly: AssemblyFileVersion("2.0.0.0")]

namespace BudgetMaaserProDesktop
{
    internal static class Program
    {
        private static readonly string PayloadMarker = "<<<BUDGET_PRO_HTML_PAYLOAD>>>";
        private static string AppDataFolder;
        private static string DatabaseFilePath;
        private static string HtmlContent;
        private static TcpListener ServerListener;
        private static bool IsRunning = true;

        [STAThread]
        private static void Main(string[] args)
        {
            try
            {
                AppDataFolder = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "BudgetMaaserPro"
                );
                if (!Directory.Exists(AppDataFolder))
                {
                    Directory.CreateDirectory(AppDataFolder);
                }

                DatabaseFilePath = Path.Combine(AppDataFolder, "database.json");
                HtmlContent = LoadEmbeddedHtml();

                if (string.IsNullOrEmpty(HtmlContent))
                {
                    MessageBox.Show(
                        "לא נמצא תוכן האפליקציה בתוך קובץ ה-EXE.",
                        "כלכלת הבית ומעשרות Pro",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                    return;
                }

                // Also save a local standalone HTML copy in AppData
                string localHtmlPath = Path.Combine(AppDataFolder, "Budget-Maaser-Pro-App.html");
                File.WriteAllText(localHtmlPath, HtmlContent, Encoding.UTF8);

                int port = StartLocalLoopbackServer();
                string appUrl = string.Format("http://127.0.0.1:{0}/", port);

                Process browserProcess = LaunchStandaloneAppWindow(appUrl);

                if (browserProcess != null)
                {
                    // Keep local server alive while the desktop window is open, up to 24 hours
                    browserProcess.WaitForExit();
                    // Give a brief grace period in case Edge/Chrome handed off to an existing process
                    Thread.Sleep(4000);
                }
                else
                {
                    Thread.Sleep(15000);
                }

                IsRunning = false;
                if (ServerListener != null)
                {
                    ServerListener.Stop();
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "שגיאה בהפעלת התוכנה:\n" + ex.Message,
                    "כלכלת הבית ומעשרות Pro",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        private static string LoadEmbeddedHtml()
        {
            // 1. Check if HTML payload is appended after PayloadMarker in the .exe file itself
            try
            {
                string exePath = Assembly.GetExecutingAssembly().Location;
                if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath))
                {
                    byte[] allBytes = File.ReadAllBytes(exePath);
                    byte[] markerBytes = Encoding.UTF8.GetBytes(PayloadMarker);
                    int idx = IndexOfBytes(allBytes, markerBytes);
                    if (idx >= 0)
                    {
                        int start = idx + markerBytes.Length;
                        return Encoding.UTF8.GetString(allBytes, start, allBytes.Length - start);
                    }
                }
            }
            catch
            {
            }

            // 2. Load from compiled .NET embedded resource
            try
            {
                Assembly asm = Assembly.GetExecutingAssembly();
                string[] names = asm.GetManifestResourceNames();
                foreach (string name in names)
                {
                    if (name.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
                    {
                        using (Stream stream = asm.GetManifestResourceStream(name))
                        {
                            if (stream != null)
                            {
                                using (StreamReader reader = new StreamReader(stream, Encoding.UTF8))
                                {
                                    return reader.ReadToEnd();
                                }
                            }
                        }
                    }
                }
            }
            catch
            {
            }

            return null;
        }

        private static int IndexOfBytes(byte[] haystack, byte[] needle)
        {
            if (needle.Length == 0 || haystack.Length < needle.Length) return -1;
            for (int i = haystack.Length - needle.Length; i >= 0; i--)
            {
                bool match = true;
                for (int j = 0; j < needle.Length; j++)
                {
                    if (haystack[i + j] != needle[j])
                    {
                        match = false;
                        break;
                    }
                }
                if (match) return i;
            }
            return -1;
        }

        private static int StartLocalLoopbackServer()
        {
            int[] preferredPorts = new int[] { 45821, 45822, 45823, 45824, 45825, 0 };
            int boundPort = 45821;

            foreach (int candidate in preferredPorts)
            {
                try
                {
                    ServerListener = new TcpListener(IPAddress.Loopback, candidate);
                    ServerListener.Start();
                    boundPort = ((IPEndPoint)ServerListener.LocalEndpoint).Port;
                    break;
                }
                catch
                {
                }
            }

            Thread serverThread = new Thread(ServerLoop);
            serverThread.IsBackground = true;
            serverThread.Start();

            return boundPort;
        }

        private static void ServerLoop()
        {
            while (IsRunning)
            {
                try
                {
                    TcpClient client = ServerListener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(HandleClient, client);
                }
                catch
                {
                    if (!IsRunning) break;
                }
            }
        }

        private static void HandleClient(object obj)
        {
            TcpClient client = (TcpClient)obj;
            try
            {
                using (NetworkStream stream = client.GetStream())
                {
                    byte[] buffer = new byte[65536];
                    int bytesRead = stream.Read(buffer, 0, buffer.Length);
                    if (bytesRead <= 0) return;

                    string requestText = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                    string[] lines = requestText.Split(new string[] { "\r\n" }, StringSplitOptions.None);
                    string requestLine = lines.Length > 0 ? lines[0] : "";

                    if (requestLine.StartsWith("GET /__desktop_db.json"))
                    {
                        string json = "{}";
                        if (File.Exists(DatabaseFilePath))
                        {
                            json = File.ReadAllText(DatabaseFilePath, Encoding.UTF8);
                        }
                        WriteHttpResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json));
                    }
                    else if (requestLine.StartsWith("POST /__desktop_db.json"))
                    {
                        int bodyIndex = requestText.IndexOf("\r\n\r\n");
                        if (bodyIndex >= 0)
                        {
                            string body = requestText.Substring(bodyIndex + 4);
                            if (!string.IsNullOrEmpty(body))
                            {
                                File.WriteAllText(DatabaseFilePath, body, Encoding.UTF8);
                            }
                        }
                        WriteHttpResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes("{\"ok\":true}"));
                    }
                    else
                    {
                        byte[] htmlBytes = Encoding.UTF8.GetBytes(HtmlContent);
                        WriteHttpResponse(stream, "200 OK", "text/html; charset=utf-8", htmlBytes);
                    }
                }
            }
            catch
            {
            }
            finally
            {
                try { client.Close(); } catch { }
            }
        }

        private static void WriteHttpResponse(NetworkStream stream, string status, string contentType, byte[] body)
        {
            string headers = string.Format(
                "HTTP/1.1 {0}\r\nContent-Type: {1}\r\nContent-Length: {2}\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n",
                status,
                contentType,
                body.Length
            );
            byte[] headerBytes = Encoding.ASCII.GetBytes(headers);
            stream.Write(headerBytes, 0, headerBytes.Length);
            stream.Write(body, 0, body.Length);
            stream.Flush();
        }

        private static Process LaunchStandaloneAppWindow(string url)
        {
            string profileDir = Path.Combine(AppDataFolder, "WindowProfile");
            string[] browserCandidates = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe")
            };

            foreach (string browserPath in browserCandidates)
            {
                if (!string.IsNullOrEmpty(browserPath) && File.Exists(browserPath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = browserPath;
                    psi.Arguments = string.Format(
                        "--app=\"{0}\" --window-size=1360,860 --user-data-dir=\"{1}\" --no-first-run --disable-extensions",
                        url,
                        profileDir
                    );
                    psi.UseShellExecute = false;
                    return Process.Start(psi);
                }
            }

            // Fallback to default system browser
            return Process.Start(url);
        }
    }
}
