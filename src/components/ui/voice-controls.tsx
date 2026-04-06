import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Volume2, VolumeX, Settings } from 'lucide-react';
import { useVoiceAnnouncements } from '@/hooks/useVoiceAnnouncements';
import { useAppLanguage } from '@/contexts/AppLanguageContext';

export function VoiceControlPanel() {
  const { getSettings, saveSettings, speak } = useVoiceAnnouncements();
  const [settings, setSettings] = useState(getSettings());
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useAppLanguage();

  const updateSetting = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const testVoice = async () => {
    await speak('This is a test of the voice announcement system.', settings);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {settings.enabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            {t("voice.title")}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quick Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t("voice.enable")}</span>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => updateSetting('enabled', checked)}
          />
        </div>

        {/* Advanced Settings */}
        {isExpanded && settings.enabled && (
          <div className="space-y-4 pt-2 border-t">
            {/* Voice Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("voice.voiceType")}</label>
              <Select
                value={settings.voice}
                onValueChange={(value) => updateSetting('voice', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female Voice</SelectItem>
                  <SelectItem value="male">Male Voice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Speed Control */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("voice.speed")}: {settings.speed.toFixed(1)}x
              </label>
              <Slider
                value={[settings.speed]}
                onValueChange={([value]) => updateSetting('speed', value)}
                min={0.5}
                max={2.0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Language Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("voice.language")}</label>
              <Select
                value={settings.language}
                onValueChange={(value) => updateSetting('language', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="en-IN">English (India)</SelectItem>
                  <SelectItem value="hi-IN">Hindi</SelectItem>
                  <SelectItem value="bn-IN">Bengali</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Test Button */}
            <Button
              onClick={testVoice}
              variant="outline"
              className="w-full"
              disabled={!settings.enabled}
            >
              <Volume2 className="h-4 w-4 mr-2" />
              {t("voice.test")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}