import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, StyleSheet, View, type KeyboardEvent, type StyleProp, type ViewStyle } from 'react-native';
import { keyboardOverlap } from '../../lib/keyboardOverlap';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Área que sobe junto com o teclado: mede quanto o teclado cobre dela e põe esse espaço embaixo, para a caixa de
 * texto e o botão de enviar ficarem sempre à vista. No Android de tela inteira (edge-to-edge) a janela não encolhe
 * com o teclado, e o `KeyboardAvoidingView` sem comportamento não faz nada; a medida na janela também desconta a
 * barra de abas que fica por baixo do teclado.
 */
export function KeyboardAwareView({ children, style }: Props) {
  const ref = useRef<View>(null);
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => {
      const { screenY, height } = e.endCoordinates;
      const keyboardTop = screenY > 0 ? screenY : Dimensions.get('screen').height - height;
      ref.current?.measureInWindow((_x, y, _w, h) => setInset(keyboardOverlap(y, h, keyboardTop)));
    };
    const show = Keyboard.addListener(showEvent, onShow);
    const hide = Keyboard.addListener(hideEvent, () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <View ref={ref} style={[styles.flex, style, { paddingBottom: inset }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
