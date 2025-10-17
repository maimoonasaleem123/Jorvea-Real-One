import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface SaveButtonProps {
  isSaved: boolean;
  onPress: () => void;
  size?: number;
  color?: string;
}

const SaveButton: React.FC<SaveButtonProps> = ({
  isSaved,
  onPress,
  size = 24,
  color = '#000',
}) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.button}>
      <Icon
        name={isSaved ? 'bookmark' : 'bookmark-outline'}
        size={size}
        color={color}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 8,
  },
});

export default SaveButton;
