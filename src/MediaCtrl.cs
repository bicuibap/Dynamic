using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace MediaControl
{
    [ComImport]
    [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    internal class MMDeviceEnumerator { }

    internal enum EDataFlow { eRender, eCapture, eAll }
    internal enum ERole { eConsole, eMultimedia, eCommunications }

    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDeviceEnumerator
    {
        int NotImpl1();
        [PreserveSig]
        int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice ppDevice);
    }

    [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDevice
    {
        [PreserveSig]
        int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    }

    [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioEndpointVolume
    {
        int NotImpl1();
        int NotImpl2();
        int GetChannelCount(out uint pnChannelCount);
        int SetMasterVolumeLevel(float fLevelDB, ref Guid pguidEventContext);
        [PreserveSig]
        int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
        int GetMasterVolumeLevel(out float pfLevelDB);
        [PreserveSig]
        int GetMasterVolumeLevelScalar(out float pfLevel);
        int SetChannelVolumeLevel(uint nChannel, float fLevelDB, ref Guid pguidEventContext);
        int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, ref Guid pguidEventContext);
        int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
        int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
        [PreserveSig]
        int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
        [PreserveSig]
        int GetMute(out bool pbMute);
    }

    class Program
    {
        [DllImport("user32.dll")]
        public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

        const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
        const uint KEYEVENTF_KEYUP = 0x0002;

        static void SendMediaKey(byte vk)
        {
            keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY, 0);
            keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0);
        }

        static IAudioEndpointVolume GetVolumeControl()
        {
            IMMDeviceEnumerator enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
            IMMDevice device;
            enumerator.GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out device);
            Guid IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;
            object o;
            device.Activate(ref IID_IAudioEndpointVolume, 0, IntPtr.Zero, out o);
            return (IAudioEndpointVolume)o;
        }

        static int GetCpuTemperature()
        {
            try
            {
                var cat = new PerformanceCounterCategory("Thermal Zone Information");
                var instances = cat.GetInstanceNames();
                foreach (var inst in instances)
                {
                    using (var pc = new PerformanceCounter("Thermal Zone Information", "Temperature", inst))
                    {
                        float raw = pc.NextValue();
                        int c = (int)Math.Round(raw - 273.15);
                        if (c >= 20 && c <= 115) return c;
                    }
                }
            }
            catch { }
            return 45;
        }

        static void Main(string[] args)
        {
            if (args.Length == 0) return;
            string cmd = args[0].ToLowerInvariant();

            if (cmd == "temp")
            {
                Console.WriteLine(GetCpuTemperature());
                return;
            }

            if (cmd == "get-volume")
            {
                try
                {
                    var vol = GetVolumeControl();
                    float level;
                    vol.GetMasterVolumeLevelScalar(out level);
                    bool mute;
                    vol.GetMute(out mute);
                    Console.WriteLine((int)Math.Round(level * 100) + ":" + mute);
                }
                catch
                {
                    Console.WriteLine("50:False");
                }
                return;
            }

            if (cmd == "set-volume" && args.Length > 1)
            {
                try
                {
                    int pct = int.Parse(args[1]);
                    pct = Math.Max(0, Math.Min(100, pct));
                    var vol = GetVolumeControl();
                    Guid empty = Guid.Empty;
                    vol.SetMasterVolumeLevelScalar(pct / 100f, ref empty);
                    if (pct > 0)
                    {
                        vol.SetMute(false, ref empty);
                    }
                    Console.WriteLine("OK");
                }
                catch (Exception ex)
                {
                    Console.WriteLine("ERR:" + ex.Message);
                }
                return;
            }

            if (cmd == "mute")
            {
                try
                {
                    var vol = GetVolumeControl();
                    bool mute;
                    vol.GetMute(out mute);
                    Guid empty = Guid.Empty;
                    vol.SetMute(!mute, ref empty);
                    Console.WriteLine("OK");
                }
                catch { }
                return;
            }

            // Media keys via keybd_event
            byte vKey = 0;
            switch (cmd)
            {
                case "play-pause":
                case "play":
                case "pause": vKey = 0xB3; break;
                case "next": vKey = 0xB0; break;
                case "prev": vKey = 0xB1; break;
            }

            if (vKey != 0)
            {
                SendMediaKey(vKey);
                Console.WriteLine("OK");
            }
        }
    }
}
