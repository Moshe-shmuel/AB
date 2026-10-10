using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;
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

        [STAThread]
        private static void Main(string[] args)
        {
            try
            {
                string appDataFolder = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "BudgetMaaserPro"
                );
                if (!Directory.Exists(appDataFolder))
                {
                    Directory.CreateDirectory(appDataFolder);
                }

                string htmlContent = LoadEmbeddedHtml();

                if (string.IsNullOrEmpty(htmlContent))
                {
                    MessageBox.Show(
                        "לא נמצא תוכן האפליקציה בתוך קובץ ה-EXE.",
                        "כלכלת הבית ומעשרות Pro",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                    return;
                }

                // Write standalone HTML to persistent AppData path so localStorage origin stays constant
                string localHtmlPath = Path.Combine(appDataFolder, "Budget-Maaser-Pro-App.html");
                File.WriteAllText(localHtmlPath, htmlContent, new UTF8Encoding(true));

                string fileUri = new Uri(localHtmlPath).AbsoluteUri;
                LaunchStandaloneDesktopWindow(fileUri, localHtmlPath, appDataFolder);
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

        private static void LaunchStandaloneDesktopWindow(string fileUri, string localHtmlPath, string appDataFolder)
        {
            string profileDir = Path.Combine(appDataFolder, "DesktopProfile");
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
                        fileUri,
                        profileDir
                    );
                    psi.UseShellExecute = false;
                    Process.Start(psi);
                    return;
                }
            }

            // Fallback to default system handler for .html
            ProcessStartInfo fallbackPsi = new ProcessStartInfo(localHtmlPath);
            fallbackPsi.UseShellExecute = true;
            Process.Start(fallbackPsi);
        }
    }
}
