import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Audio } from 'expo-av'; 

const FeaturedShowTile = ({ show }) => {
  const playAudio = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: show.audioUrl });
      await sound.playAsync();
    } catch (error) {
      Alert.alert('Error', 'Unable to play audio');
    }
  };

  return (
    <TouchableOpacity onPress={playAudio} style={styles.tile}>
      <Image source={{ uri: show.imageUrl }} style={styles.image} />
      <Text style={styles.title}>{show.title}</Text>
      <Text style={styles.description}>{show.description}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  tile: {
    margin: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    elevation: 2,
  },
  image: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
});

export default FeaturedShowTile; 