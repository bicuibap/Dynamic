using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace MediaControl
{
    class Program
    {
        [DllImport("user32.dll")]
        public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

        const byte VK_MEDIA_NEXT_TRACK = 0xB0;
        const byte VK_MEDIA_PREV_TRACK = 0xB1;
        const byte VK_MEDIA_PLAY_PAUSE = 0xB3;
        const uint KEYEVENTF_KEYUP = 0x0002;

        static int GetCpuTemperature()
        {
            try
            {
                PerformanceCounterCategory cat = new PerformanceCounterCategory("Thermal Zone Information");
                string[] instances = cat.GetInstanceNames();
                if (instances.Length > 0)
                {
                    using (PerformanceCounter pc = new PerformanceCounter("Thermal Zone Information", "Temperature", instances[0]))
                    {
                        float val = pc.NextValue();
                        int c = (int)Math.Round(val - 273.15f);
                        if (c >= 20 && c <= 120) return c;
                    }
                }
            }
            catch {}
            return 0;
        }

        static void Main(string[] args)
        {
            if (args.Length == 0) return;
            string action = args[0].ToLowerInvariant();

            if (action == "temp" || action == "cpu-temp")
            {
                int temp = GetCpuTemperature();
                Console.WriteLine(temp);
                return;
            }

            byte vKey = 0;
            switch (action)
            {
                case "play-pause":
                case "play":
                case "pause":
                    vKey = VK_MEDIA_PLAY_PAUSE;
                    break;
                case "next":
                    vKey = VK_MEDIA_NEXT_TRACK;
                    break;
                case "prev":
                    vKey = VK_MEDIA_PREV_TRACK;
                    break;
            }

            if (vKey != 0)
            {
                keybd_event(vKey, 0, 0, 0);
                keybd_event(vKey, 0, KEYEVENTF_KEYUP, 0);
            }
        }
    }
}
