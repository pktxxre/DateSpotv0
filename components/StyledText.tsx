import { Text as RNText, TextProps } from 'react-native';
import { Fonts } from '@/lib/theme';

export function Text(props: TextProps) {
  return (
    <RNText
      {...props}
      style={[{ fontFamily: Fonts.sans }, props.style]}
    />
  );
}

export function SerifText(props: TextProps) {
  return (
    <RNText
      {...props}
      style={[{ fontFamily: Fonts.serif }, props.style]}
    />
  );
}

export function MonoText(props: TextProps) {
  return (
    <RNText
      {...props}
      style={[{ fontFamily: Fonts.mono }, props.style]}
    />
  );
}
